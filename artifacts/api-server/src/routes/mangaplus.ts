import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const _mpCache = new Map<string, { data: unknown; expiresAt: number }>();
function withMpCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _mpCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    _mpCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

const MP_API = "https://jumpg-webapi.tokyo-cdn.com/api";

const MP_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "application/x-protobuf",
  "Referer": "https://mangaplus.shueisha.co.jp/",
  "Origin": "https://mangaplus.shueisha.co.jp",
};

async function mpFetch(path: string): Promise<Buffer> {
  const url = path.startsWith("http") ? path : `${MP_API}${path}`;
  const res = await fetch(url, { headers: MP_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`MangaPlus ${path} returned ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ─── Minimal protobuf parser ───────────────────────────────────────────────────

function readVarint(buf: Buffer, pos: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  while (pos < buf.length) {
    const byte = buf[pos++]!;
    result |= BigInt(byte & 0x7f) << shift;
    shift += 7n;
    if ((byte & 0x80) === 0) break;
  }
  return [result, pos];
}

type ProtoFields = Map<number, unknown[]>;

function parseProto(buf: Buffer): ProtoFields {
  const fields: ProtoFields = new Map();
  let pos = 0;
  while (pos < buf.length) {
    if (pos >= buf.length) break;
    let tag: bigint;
    try {
      [tag, pos] = readVarint(buf, pos);
    } catch { break; }
    const fieldNumber = Number(tag >> 3n);
    const wireType = Number(tag & 7n);
    if (fieldNumber === 0) break;
    if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
    if (wireType === 0) {
      const [val, p] = readVarint(buf, pos);
      pos = p;
      fields.get(fieldNumber)!.push(val);
    } else if (wireType === 2) {
      const [len, p] = readVarint(buf, pos);
      pos = p;
      const n = Number(len);
      if (n < 0 || pos + n > buf.length) break;
      const data = buf.subarray(pos, pos + n);
      pos += n;
      fields.get(fieldNumber)!.push(Buffer.from(data));
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }
  return fields;
}

function str(f: ProtoFields, n: number): string {
  const v = f.get(n)?.[0];
  if (v instanceof Buffer) return v.toString("utf8");
  return "";
}

function uint32(f: ProtoFields, n: number): number {
  const v = f.get(n)?.[0];
  if (typeof v === "bigint") return Number(v) & 0xffffffff;
  return 0;
}

function msgs(f: ProtoFields, n: number): Buffer[] {
  return (f.get(n) ?? []).filter((v): v is Buffer => v instanceof Buffer);
}

// ─── Domain types ─────────────────────────────────────────────────────────────

interface MPTitle {
  id: number;
  name: string;
  author: string;
  coverUrl: string;
  viewCount: number;
}

interface MPChapter {
  chapterId: number;
  titleId: number;
  name: string;
  subTitle: string;
  thumbnailUrl: string;
  startAt: number;
  isAvailable: boolean;
}

interface MPSeriesDetail {
  id: number;
  name: string;
  author: string;
  coverUrl: string;
  overview: string;
  backgroundUrl: string;
  firstChapters: MPChapter[];
  lastChapters: MPChapter[];
}

interface MPPage {
  imageUrl: string;
  width: number;
  height: number;
  encryptionKey: string;
}

// Parse a Title message (field layout from MangaPlus protobuf schema)
function parseTitle(buf: Buffer): MPTitle | null {
  const f = parseProto(buf);
  const id = uint32(f, 1);
  const name = str(f, 2);
  if (!id || !name) return null;
  return {
    id,
    name,
    author: str(f, 3),
    coverUrl: str(f, 4),
    viewCount: uint32(f, 5),
  };
}

// Parse a Chapter message
function parseChapter(buf: Buffer, now: number): MPChapter | null {
  const f = parseProto(buf);
  const chapterId = uint32(f, 2);
  const titleId = uint32(f, 1);
  if (!chapterId) return null;
  const endAt = uint32(f, 7);
  const startAt = uint32(f, 6);
  const isAvailable = endAt === 0 || endAt > now;
  return {
    chapterId,
    titleId,
    name: str(f, 3),
    subTitle: str(f, 4),
    thumbnailUrl: str(f, 5),
    startAt,
    isAvailable,
  };
}

// Fetch all titles
async function fetchAllTitles(): Promise<MPTitle[]> {
  const buf = await mpFetch("/title_list/allV2");
  const root = parseProto(buf);
  // MangaPlusResponse field 11 = SuccessResult
  const successBufs = msgs(root, 11);
  if (!successBufs.length) return [];
  const success = parseProto(successBufs[0]!);
  // SuccessResult field 25 = repeated AllTitleGroup
  const allGroups = msgs(success, 25);
  const titles: MPTitle[] = [];
  const seen = new Set<number>();
  for (const groupBuf of allGroups) {
    const gf = parseProto(groupBuf);
    // AllTitleGroup field 2 = repeated Title
    for (const titleBuf of msgs(gf, 2)) {
      const t = parseTitle(titleBuf);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        titles.push(t);
      }
    }
  }
  return titles;
}

// Fetch series detail for a title
async function fetchTitleDetail(titleId: number): Promise<MPSeriesDetail | null> {
  const buf = await mpFetch(`/title_detail?title_id=${titleId}`);
  const root = parseProto(buf);
  const successBufs = msgs(root, 11);
  if (!successBufs.length) return null;
  const success = parseProto(successBufs[0]!);
  // SuccessResult field 8 = TitleDetailView
  const detailBufs = msgs(success, 8);
  if (!detailBufs.length) return null;
  const detail = parseProto(detailBufs[0]!);

  // TitleDetailView field 1 = Title
  const titleBufs = msgs(detail, 1);
  if (!titleBufs.length) return null;
  const title = parseTitle(titleBufs[0]!);
  if (!title) return null;

  const overview = str(detail, 2);
  const backgroundUrl = str(detail, 3);
  const now = Math.floor(Date.now() / 1000);

  // field 9 = firstChapterList, field 10 = lastChapterList
  const firstChapters: MPChapter[] = msgs(detail, 9).map((b) => parseChapter(b, now)).filter((c): c is MPChapter => c !== null);
  const lastChapters: MPChapter[] = msgs(detail, 10).map((b) => parseChapter(b, now)).filter((c): c is MPChapter => c !== null);

  return {
    id: title.id,
    name: title.name,
    author: title.author,
    coverUrl: title.coverUrl,
    overview,
    backgroundUrl,
    firstChapters,
    lastChapters,
  };
}

// Fetch chapter pages
async function fetchMangaViewer(chapterId: number): Promise<MPPage[]> {
  const buf = await mpFetch(`/manga_viewer?chapter_id=${chapterId}&split=no&img_quality=high`);
  const root = parseProto(buf);
  const successBufs = msgs(root, 11);
  if (!successBufs.length) return [];
  const success = parseProto(successBufs[0]!);
  // SuccessResult field 10 = MangaViewer
  const viewerBufs = msgs(success, 10);
  if (!viewerBufs.length) return [];
  const viewer = parseProto(viewerBufs[0]!);

  const pages: MPPage[] = [];
  // MangaViewer field 1 = repeated MangaPage
  for (const pageBuf of msgs(viewer, 1)) {
    const pagef = parseProto(pageBuf);
    // MangaPage field 1 = MangaPageData (the actual page image, not ads/blanks)
    const pageDataBufs = msgs(pagef, 1);
    if (!pageDataBufs.length) continue;
    const pf = parseProto(pageDataBufs[0]!);
    const imageUrl = str(pf, 1);
    if (!imageUrl) continue;
    pages.push({
      imageUrl,
      width: uint32(pf, 2),
      height: uint32(pf, 3),
      encryptionKey: str(pf, 5),
    });
  }
  return pages;
}

// ─── Image decryption ─────────────────────────────────────────────────────────

function decryptMangaPlus(buf: Buffer, encKey: string): Buffer {
  if (!encKey) return buf;
  // Key is a hex string; take first 8 hex chars = 4 bytes
  const keyHex = encKey.replace(/[^0-9a-fA-F]/g, "").slice(0, 8);
  if (keyHex.length < 2) return buf;
  const keyBytes: number[] = [];
  for (let i = 0; i < keyHex.length; i += 2) {
    keyBytes.push(parseInt(keyHex.slice(i, i + 2), 16));
  }
  const result = Buffer.allocUnsafe(buf.length);
  for (let i = 0; i < buf.length; i++) {
    result[i] = (buf[i] ?? 0) ^ (keyBytes[i % keyBytes.length] ?? 0);
  }
  return result;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/mangaplus/home  → featured and popular titles
router.get("/mangaplus/home", async (_req: Request, res: Response): Promise<void> => {
  try {
    const titles = await withMpCache("mp:all", 15 * 60 * 1000, fetchAllTitles);
    // Sort by view count descending for popular
    const sorted = [...titles].sort((a, b) => b.viewCount - a.viewCount);
    // English-language titles only (language field 0 = English, 1 = Spanish)
    // We include all since language field might not always be set
    const featured = sorted.slice(0, 10);
    const popular = sorted.slice(0, 50);
    const latest = sorted.slice(0, 30); // We don't have real "latest" without dates, use first 30
    res.json({ featured, popular, latest });
  } catch (err) {
    console.error("[MangaPlus] home error:", err);
    res.status(502).json({ error: "Failed to fetch MangaPlus home", featured: [], popular: [], latest: [] });
  }
});

// GET /api/mangaplus/popular?page=1
router.get("/mangaplus/popular", async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 30;
  try {
    const titles = await withMpCache("mp:all", 15 * 60 * 1000, fetchAllTitles);
    const sorted = [...titles].sort((a, b) => b.viewCount - a.viewCount);
    const start = (page - 1) * limit;
    const results = sorted.slice(start, start + limit);
    const totalPages = Math.ceil(sorted.length / limit);
    res.json({ results, page, totalPages, hasMore: page < totalPages, total: sorted.length });
  } catch (err) {
    console.error("[MangaPlus] popular error:", err);
    res.status(502).json({ error: "Failed", results: [], page: 1, totalPages: 1, hasMore: false });
  }
});

// GET /api/mangaplus/series/:titleId
router.get("/mangaplus/series/:titleId", async (req: Request, res: Response): Promise<void> => {
  const titleId = parseInt(req.params.titleId ?? "0", 10);
  if (!titleId) { res.status(400).json({ error: "invalid titleId" }); return; }

  try {
    const data = await withMpCache(`mp:series:${titleId}`, 10 * 60 * 1000, () => fetchTitleDetail(titleId));
    if (!data) { res.status(404).json({ error: "Series not found" }); return; }
    res.json(data);
  } catch (err) {
    console.error(`[MangaPlus] series ${titleId} error:`, err);
    res.status(502).json({ error: "Failed to fetch series" });
  }
});

// GET /api/mangaplus/chapters/:chapterId
router.get("/mangaplus/chapters/:chapterId", async (req: Request, res: Response): Promise<void> => {
  const chapterId = parseInt(req.params.chapterId ?? "0", 10);
  if (!chapterId) { res.status(400).json({ error: "invalid chapterId" }); return; }

  try {
    const pages = await withMpCache(`mp:chapter:${chapterId}`, 30 * 60 * 1000, () => fetchMangaViewer(chapterId));
    res.json({ chapterId, pages });
  } catch (err) {
    console.error(`[MangaPlus] chapter ${chapterId} error:`, err);
    res.status(502).json({ error: "Failed to fetch chapter", pages: [] });
  }
});

// GET /api/mangaplus/image?url=...&key=...   – decrypt + proxy MangaPlus image
router.get("/mangaplus/image", async (req: Request, res: Response): Promise<void> => {
  const url = String(req.query.url ?? "");
  const key = String(req.query.key ?? "");
  if (!url.startsWith("http")) { res.status(400).json({ error: "bad url" }); return; }

  try {
    const imgRes = await fetch(url, {
      headers: {
        "Referer": "https://mangaplus.shueisha.co.jp/",
        "Origin": "https://mangaplus.shueisha.co.jp",
        "User-Agent": MP_HEADERS["User-Agent"] ?? "",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!imgRes.ok) { res.status(imgRes.status).end(); return; }
    const ab = await imgRes.arrayBuffer();
    let buf = Buffer.from(ab);
    if (key) buf = decryptMangaPlus(buf, key);

    const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
    res.set("Content-Type", ct.includes("image/") ? ct : "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch (err) {
    console.error("[MangaPlus] image proxy error:", err);
    res.status(502).end();
  }
});

// GET /api/mangaplus/search?q=
router.get("/mangaplus/search", async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  if (!q) { res.json({ results: [] }); return; }

  try {
    const titles = await withMpCache("mp:all", 15 * 60 * 1000, fetchAllTitles);
    const results = titles
      .filter((t) => t.name.toLowerCase().includes(q) || t.author.toLowerCase().includes(q))
      .slice(0, 30);
    res.json({ results });
  } catch (err) {
    console.error("[MangaPlus] search error:", err);
    res.status(502).json({ error: "Search failed", results: [] });
  }
});

export default router;
