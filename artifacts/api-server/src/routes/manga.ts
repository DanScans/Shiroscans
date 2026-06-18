import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── Simple TTL in-memory cache ───────────────────────────────────────────────
type CacheEntry = { data: unknown; expiresAt: number };
const _apiCache = new Map<string, CacheEntry>();
function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _apiCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    _apiCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

// ─── Image buffer cache (avoids round-tripping same image twice) ───────────────
const _imgCache = new Map<string, { buf: Buffer; ct: string; ts: number }>();
const IMG_CACHE_MAX = 400;
const IMG_CACHE_TTL = 6 * 3600 * 1000; // 6 hours
function pruneImgCache() {
  if (_imgCache.size <= IMG_CACHE_MAX) return;
  const sorted = [..._imgCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
  sorted.slice(0, sorted.length - IMG_CACHE_MAX).forEach(([k]) => _imgCache.delete(k));
}

// ─── Base URLs ──────────────────────────────────────────────────────────────
// LOCAL comick-source-api clone runs at port 3001
// Fall back to the hosted instance if local is unavailable
const COMICK_LOCAL = "http://localhost:3001";
const COMICK_REMOTE = "https://comick-source-api.notaspider.dev";
const MDX_BASE = "https://api.mangadex.org";
const MDX_COVERS = "https://uploads.mangadex.org/covers";
const MDX_QUALITY = "data";

// ─── Types from comick-source-api (matching actual TypeScript interfaces) ────

interface FrontpageManga {
  id: string;
  title: string;
  url: string;
  coverImage?: string;
  latestChapter?: number;
  lastUpdated?: string;
  lastUpdatedTimestamp?: number;
  rating?: number;
  followers?: string;
  type?: string;
  status?: string;
  synopsis?: string;
}

interface SearchResult {
  id: string;
  title: string;
  url: string;
  coverImage?: string;
  latestChapter: number;
  lastUpdated: string;
  lastUpdatedTimestamp?: number;
  rating?: number;
  followers?: string;
}

interface ScrapedChapter {
  id: string;
  number: number;
  title?: string;
  url: string;
  isDownloaded?: boolean;
  lastUpdated?: string;
  group?: { id: string; name: string; url?: string };
}

interface FrontpageSection {
  id: string;
  title: string;
  type: string;
  items: FrontpageManga[];
  supportsPagination: boolean;
  supportsTimeFilter: boolean;
}

interface FrontpageResponse {
  source: string;
  sourceName: string;
  section: FrontpageSection;
  fetchedAt: number;
}

interface ChaptersResponse {
  chapters: ScrapedChapter[];
  source: string;
  totalChapters: number;
}

interface StreamingSearchLine {
  source: string;
  results: SearchResult[];
  error?: string;
  done: boolean;
}

// ─── Comick Source API client (local-first, remote fallback) ─────────────────

async function comickFetch(endpoint: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  // Try local first with a very short timeout — if nothing answers in 1.5s, go remote immediately
  const localTimeout = 1500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), localTimeout);
  try {
    const res = await fetch(`${COMICK_LOCAL}${endpoint}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "User-Agent": "ShiroScans/2.0", ...init.headers },
    });
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    // Fallback to remote hosted instance
    const res2 = await fetch(`${COMICK_REMOTE}${endpoint}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "Content-Type": "application/json", "User-Agent": "ShiroScans/2.0", ...init.headers },
    });
    return res2;
  }
}

async function comickPost<T>(endpoint: string, body: unknown, timeoutMs = 8000): Promise<T> {
  const res = await comickFetch(endpoint, { method: "POST", body: JSON.stringify(body) }, timeoutMs);
  if (!res.ok) throw new Error(`Comick API ${endpoint} returned ${res.status}`);
  return res.json() as Promise<T>;
}

async function comickGet<T>(endpoint: string, timeoutMs = 8000): Promise<T> {
  const res = await comickFetch(endpoint, { method: "GET" }, timeoutMs);
  if (!res.ok) throw new Error(`Comick API ${endpoint} returned ${res.status}`);
  return res.json() as Promise<T>;
}

// Search returns a streaming NDJSON response — consume and collect all results
async function comickSearch(query: string, source: string): Promise<SearchResult[]> {
  const res = await comickFetch("/api/search", {
    method: "POST",
    body: JSON.stringify({ query, source }),
  }, 30000);

  if (!res.ok) throw new Error(`Comick search returned ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split("\n").filter(Boolean);
  const results: SearchResult[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as StreamingSearchLine;
      if (!parsed.done && Array.isArray(parsed.results)) {
        results.push(...parsed.results);
      }
    } catch {
      // skip malformed lines
    }
  }

  return results;
}

// ─── MangaDex helpers ────────────────────────────────────────────────────────

interface MdxManga {
  id: string;
  type: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    description?: Record<string, string>;
    originalLanguage?: string;
    status?: string;
    publicationDemographic?: string;
    contentRating?: string;
    tags?: Array<{ attributes: { name: Record<string, string>; group: string } }>;
    lastChapter?: string;
  };
  relationships: Array<{ id: string; type: string; attributes?: Record<string, unknown> }>;
}

interface MdxChapter {
  id: string;
  attributes: {
    chapter?: string;
    title?: string;
    publishAt?: string;
    pages?: number;
    translatedLanguage?: string;
  };
}

async function mdx<T = Record<string, unknown>>(
  path: string,
  params?: Record<string, string | string[] | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${MDX_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, String(item)));
      else url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "ShiroScans/2.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`MangaDex ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

function getCoverUrl(mangaId: string, fileName: string | undefined): string {
  if (!fileName) return "";
  return `${MDX_COVERS}/${mangaId}/${fileName}.512.jpg`;
}

function extractCoverFileName(manga: MdxManga): string | undefined {
  return manga.relationships.find((r) => r.type === "cover_art")?.attributes?.["fileName"] as string | undefined;
}

function getMangaStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const map: Record<string, string> = { ongoing: "Ongoing", completed: "Completed", hiatus: "Hiatus", cancelled: "Cancelled" };
  return map[status.toLowerCase()] ?? status;
}

function typeToOriginalLanguage(type: string | undefined): string[] | undefined {
  if (!type) return undefined;
  const t = type.toLowerCase();
  if (t === "manhwa" || t === "webtoon") return ["ko"];
  if (t === "manhua") return ["zh", "zh-hk"];
  if (t === "manga") return ["ja"];
  return undefined;
}

function normalizeMdxManga(m: MdxManga, coverFileName?: string) {
  const title = m.attributes.title["en"] ?? m.attributes.title["ja-ro"] ?? Object.values(m.attributes.title)[0] ?? "Unknown";
  const genres = (m.attributes.tags ?? [])
    .filter((t) => t.attributes.group === "genre" || t.attributes.group === "theme")
    .map((t) => t.attributes.name["en"] ?? Object.values(t.attributes.name)[0])
    .filter(Boolean) as string[];
  const lang = m.attributes.originalLanguage ?? "ja";
  const type = lang === "ko" ? "Manhwa" : ["zh", "zh-hk"].includes(lang) ? "Manhua" : "Manga";
  return {
    id: m.id,
    title,
    coverImage: getCoverUrl(m.id, coverFileName),
    provider: "mangadex",
    type,
    status: getMangaStatus(m.attributes.status),
    rating: null as number | null,
    latestChapter: m.attributes.lastChapter ? `Ch. ${m.attributes.lastChapter}` : null,
    genres,
    isNew: false,
    updatedAt: null as string | null,
  };
}

// ─── Comick item normalizer ───────────────────────────────────────────────────

function inferTypeFromSource(source: string, itemType?: string): string {
  if (itemType) {
    const t = itemType.toLowerCase();
    if (t.includes("manhwa") || t === "korean") return "Manhwa";
    if (t.includes("manhua") || t === "chinese") return "Manhua";
    if (t.includes("webtoon")) return "Webtoon";
    if (t.includes("manga") || t === "japanese") return "Manga";
  }
  const koreanSources = ["weebcentral", "asurascan", "asurascans"];
  if (koreanSources.includes(source.toLowerCase())) return "Manhwa";
  return "Manga";
}

function normalizeComickItem(item: FrontpageManga | SearchResult, source: string) {
  // Use the manga URL as the unique identifier — it works with the chapters API
  const mangaUrl = item.url;
  const coverImage = item.coverImage ?? "";
  const latestChapterNum = item.latestChapter;
  const latestChapter = latestChapterNum != null && latestChapterNum > 0 ? `Ch. ${latestChapterNum}` : null;
  const status = (item as FrontpageManga).status;
  const itemType = (item as FrontpageManga).type;

  return {
    id: mangaUrl,
    title: item.title ?? "Unknown",
    coverImage,
    provider: source,
    type: inferTypeFromSource(source, itemType),
    status: status ? getMangaStatus(status) : null,
    rating: item.rating != null ? parseFloat(String(item.rating)) || null : null,
    latestChapter,
    genres: [] as string[],
    isNew: false,
    updatedAt: item.lastUpdated ?? null,
  };
}

function getScraperNameFromSource(source: string): string {
  const map: Record<string, string> = {
    comix: "Comix",
    asurascan: "AsuraScan",
    weebcentral: "WeebCentral",
    mangago: "Mangago",
    mangakatana: "MangaKatana",
    asurascans: "AsuraScans",
    thunderscans: "Thunderscans",
    "vortex-scans": "Vortex Scans",
    "raven-scans": "Raven Scans",
    mangaread: "MangaRead",
    mgeko: "Mgeko",
    novelcool: "NovelCool",
    mangaloom: "Mangaloom",
    mangasushi: "Mangasushi",
    mangataro: "Mangataro",
    mangayy: "Mangayy",
    topmanhua: "TopManhua",
    utoon: "UTOON",
    likemanga: "LikeManga",
    demonicscans: "DemonicScans",
    firescans: "Firescans",
    "galaxy-degen-scans": "Galaxy Degen Scans",
    "greed-scans": "Greed Scans",
    "hades-scans": "Hades Scans",
  };
  return map[source.toLowerCase()] ?? source;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /manga/sources — MangaDex and AsuraScans
router.get("/manga/sources", (_req, res): void => {
  res.json([
    { id: "mangadex", name: "MangaDex", status: "active", type: "aggregator" },
    { id: "asurascans", name: "AsuraScans", status: "active", type: "scanlation" },
  ]);
});

// GET /manga/home — MangaDex latest + popular (cached 5 min)
router.get("/manga/home", async (req, res): Promise<void> => {
  try {
    const payload = await withCache("manga:home", 5 * 60_000, async () => {
      const [mdxLatestResult, mdxPopularResult] = await Promise.allSettled([
        mdx<{ data: MdxManga[] }>("/manga", {
          limit: 20, "order[latestUploadedChapter]": "desc", "includes[]": ["cover_art"],
          "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": ["en"],
        }),
        mdx<{ data: MdxManga[] }>("/manga", {
          limit: 20, "order[followedCount]": "desc", "includes[]": ["cover_art"],
          "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": ["en"],
        }),
      ]);
      const mdxLatest = mdxLatestResult.status === "fulfilled"
        ? mdxLatestResult.value.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)))
        : [];
      const mdxPopular = mdxPopularResult.status === "fulfilled"
        ? mdxPopularResult.value.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)))
        : [];
      return { featured: mdxPopular.slice(0, 6), latestUpdates: mdxLatest, popularNow: mdxPopular, newSeries: [] };
    });
    res.setHeader("Cache-Control", "public, max-age=240, s-maxage=300");
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch home feed");
    res.json({ featured: [], latestUpdates: [], popularNow: [], newSeries: [] });
  }
});

// POST /manga/frontpage
router.post("/manga/frontpage", async (req, res): Promise<void> => {
  const { source = "comix", section = "trending", page = 1, limit = 30, days } = req.body as {
    source?: string; section?: string; page?: number; limit?: number; days?: number;
  };
  try {
    const body: Record<string, unknown> = { source, section, page, limit };
    if (days !== undefined) body.days = days;
    const data = await comickPost<FrontpageResponse>("/api/frontpage", body);
    const items = (data.section?.items ?? []).map((item) => normalizeComickItem(item, source));
    res.json({ items, source, section, page });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch frontpage");
    res.status(500).json({ items: [], source, section, page });
  }
});

// GET /manga/latest
router.get("/manga/latest", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const provider = req.query.provider ? String(req.query.provider) : "mangadex";
  const type = req.query.type ? String(req.query.type) : undefined;
  const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
  const genre = req.query.genre ? String(req.query.genre) : undefined;
  const offset = (page - 1) * 20;
  const cacheKey = `manga:latest:${provider}:${page}:${type ?? ""}:${status ?? ""}:${genre ?? ""}`;

  if (provider === "mangadex") {
    try {
      const result = await withCache(cacheKey, 3 * 60_000, async () => {
        const params: Record<string, string | string[] | number | boolean | undefined> = {
          limit: 20, offset, "order[latestUploadedChapter]": "desc", "includes[]": ["cover_art"],
          "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": ["en"],
        };
        if (status && ["ongoing", "completed", "hiatus", "cancelled"].includes(status)) params["status[]"] = [status];
        const origLangs = typeToOriginalLanguage(type);
        if (origLangs?.length) params["originalLanguage[]"] = origLangs;
        if (genre) {
          const tagId = await getMdxTagId(genre);
          if (tagId) params["includedTags[]"] = [tagId];
        }
        const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", params);
        const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
        return { items, page, hasMore: offset + items.length < data.total };
      });
      res.setHeader("Cache-Control", "public, max-age=120");
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "MangaDex latest failed");
      res.json({ items: [], page, hasMore: false });
    }
    return;
  }

  try {
    const result = await withCache(cacheKey, 3 * 60_000, async () => {
      const data = await comickPost<FrontpageResponse>("/api/frontpage", {
        source: provider, section: "latest_hot", page, limit: 24,
      });
      const raw = data.section?.items ?? [];
      const items = raw.map((item) => normalizeComickItem(item, provider)).filter((item) => {
        if (status && item.status && item.status.toLowerCase() !== status.toLowerCase()) return false;
        if (type && item.type && item.type.toLowerCase() !== type.toLowerCase()) return false;
        if (genre && item.genres?.length) {
          const g = genre.toLowerCase();
          if (!item.genres.some((ig) => ig.toLowerCase() === g)) return false;
        }
        return true;
      });
      return { items, page, hasMore: raw.length >= 24 };
    });
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Comick latest failed");
    res.json({ items: [], page, hasMore: false });
  }
});

// GET /manga/popular
router.get("/manga/popular", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const provider = req.query.provider ? String(req.query.provider) : "mangadex";
  const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const genre = req.query.genre ? String(req.query.genre) : undefined;
  const offset = (page - 1) * 20;
  const cacheKey = `manga:popular:${provider}:${page}:${type ?? ""}:${status ?? ""}:${genre ?? ""}`;

  if (provider === "mangadex") {
    try {
      const result = await withCache(cacheKey, 10 * 60_000, async () => {
        const params: Record<string, string | string[] | number | boolean | undefined> = {
          limit: 20, offset, "order[followedCount]": "desc", "includes[]": ["cover_art"],
          "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": ["en"],
        };
        if (status && ["ongoing", "completed", "hiatus", "cancelled"].includes(status)) params["status[]"] = [status];
        const origLangs = typeToOriginalLanguage(type);
        if (origLangs?.length) params["originalLanguage[]"] = origLangs;
        if (genre) {
          const tagId = await getMdxTagId(genre);
          if (tagId) params["includedTags[]"] = [tagId];
        }
        const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", params);
        const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
        return { items, page, hasMore: offset + items.length < data.total };
      });
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "MangaDex popular failed");
      res.json({ items: [], page, hasMore: false });
    }
    return;
  }

  try {
    const result = await withCache(cacheKey, 10 * 60_000, async () => {
      const data = await comickPost<FrontpageResponse>("/api/frontpage", {
        source: provider, section: "trending", page, limit: 24, days: 30,
      });
      const raw = data.section?.items ?? [];
      const items = raw.map((item) => normalizeComickItem(item, provider)).filter((item) => {
        if (status && item.status && item.status.toLowerCase() !== status.toLowerCase()) return false;
        if (type && item.type && item.type.toLowerCase() !== type.toLowerCase()) return false;
        if (genre && item.genres?.length) {
          const g = genre.toLowerCase();
          if (!item.genres.some((ig) => ig.toLowerCase() === g)) return false;
        }
        return true;
      });
      return { items, page, hasMore: raw.length >= 24 };
    });
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Comick popular failed");
    res.json({ items: [], page, hasMore: false });
  }
});

// GET /manga/suggestions — fast typeahead (MangaDex only, limit 6, cached 2min)
router.get("/manga/suggestions", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q) { res.json({ items: [] }); return; }
  const cacheKey = `manga:suggest:${q.toLowerCase()}`;
  try {
    const result = await withCache(cacheKey, 2 * 60_000, async () => {
      const data = await mdx<{ data: MdxManga[] }>("/manga", {
        title: q, limit: 6, "includes[]": ["cover_art"], "contentRating[]": ["safe", "suggestive"],
      });
      const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
      return { items };
    });
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(result);
  } catch {
    res.json({ items: [] });
  }
});

// GET /manga/search
router.get("/manga/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const provider = req.query.provider ? String(req.query.provider) : "all";
  const offset = (page - 1) * 20;

  if (!q) { res.json({ items: [], page: 1, hasMore: false }); return; }
  const cacheKey = `manga:search:${provider}:${q.toLowerCase()}:${page}`;

  if (provider === "mangadex") {
    try {
      const result = await withCache(cacheKey, 2 * 60_000, async () => {
        const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", {
          title: q, limit: 20, offset, "includes[]": ["cover_art"], "contentRating[]": ["safe", "suggestive"],
        });
        const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
        return { items, page, hasMore: offset + items.length < data.total };
      });
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "MangaDex search failed");
      res.json({ items: [], page: 1, hasMore: false });
    }
    return;
  }

  // Multi-source search via comick streaming NDJSON + MangaDex in parallel
  const source = provider === "all" ? "all" : provider;
  try {
    const [comickResults, mdxResult] = await Promise.allSettled([
      comickSearch(q, source),
      provider === "all"
        ? mdx<{ data: MdxManga[] }>("/manga", { title: q, limit: 10, offset: 0, "includes[]": ["cover_art"], "contentRating[]": ["safe", "suggestive"] })
        : Promise.reject(new Error("skip")),
    ]);

    // Detect source from manga URL to correctly label multi-source results
    function detectSourceFromUrl(url: string, fallback: string): string {
      if (!url) return fallback;
      if (url.includes("weebcentral.com")) return "weebcentral";
      if (url.includes("comix.to")) return "comix";
      if (url.includes("asurascans.com")) return "asurascan";
      if (url.includes("mgeko.cc")) return "mgeko";
      if (url.includes("mangago.")) return "mangago";
      if (url.includes("mangakatana.com")) return "mangakatana";
      if (url.includes("webtoons.com")) return "webtoon";
      if (url.includes("vortexscans.org")) return "vortex-scans";
      if (url.includes("ravenscans.org")) return "raven-scans";
      if (url.includes("asurascans.com")) return "asurascans";
      if (url.includes("novelcool.com")) return "novelcool";
      if (url.includes("topmanhua.") || url.includes("manhuatop.")) return "topmanhua";
      if (url.includes("mangaloom.com")) return "mangaloom";
      if (url.includes("manhuaplus.")) return "manhuaplus";
      if (url.includes("likemanga.")) return "likemanga";
      if (url.includes("mangaread.org")) return "mangaread";
      return fallback;
    }

    const comickItems = comickResults.status === "fulfilled"
      ? comickResults.value.map((item) => {
          const detectedSource = detectSourceFromUrl(item.url ?? "", source === "all" ? "comix" : source);
          return normalizeComickItem(item, detectedSource);
        })
      : [];

    const mdxItems: ReturnType<typeof normalizeMdxManga>[] = [];
    if (provider === "all" && mdxResult.status === "fulfilled" && "data" in mdxResult.value) {
      const d = mdxResult.value as { data: MdxManga[] };
      mdxItems.push(...d.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m))));
    }

    const seen = new Set<string>();
    const deduped: Array<ReturnType<typeof normalizeComickItem> | ReturnType<typeof normalizeMdxManga>> = [];
    for (const item of [...comickItems, ...mdxItems]) {
      const key = item.title.toLowerCase().replace(/\s+/g, "");
      if (!seen.has(key)) { seen.add(key); deduped.push(item); }
    }

    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ items: deduped, page: 1, hasMore: false });
  } catch (err) {
    req.log.error({ err }, "Search failed");
    res.json({ items: [], page: 1, hasMore: false });
  }
});

// GET /manga/series/:provider/:id
router.get("/manga/series/:provider/:id", async (req, res): Promise<void> => {
  const safeProvider = decodeURIComponent(Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider ?? "mangadex");
  const safeId = decodeURIComponent(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id ?? "");

  if (safeProvider === "mangadex") {
    try {
      const result = await withCache(`mdx:series:${safeId}`, 30 * 60 * 1000, async () => {
        const feedParams = {
          limit: 500, "order[chapter]": "desc",
          "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
        };

        // Parallel: manga info + first page of chapters (all languages — covers manga with no English)
        const [m, firstFeed] = await Promise.all([
          mdx<{ data: MdxManga }>(`/manga/${safeId}`, { "includes[]": ["cover_art", "author", "artist"] })
            .then((r) => r.data),
          mdx<{ data: MdxChapter[]; total: number }>(`/manga/${safeId}/feed`, feedParams),
        ]);

        // If >500 chapters total, fetch remaining pages (capped at 1500 total = 3 pages)
        let allChapters: MdxChapter[] = firstFeed.data;
        if (firstFeed.total > 500) {
          const extraPages = Math.min(Math.ceil((firstFeed.total - 500) / 500), 2);
          const extras = await Promise.all(
            Array.from({ length: extraPages }, (_, i) =>
              mdx<{ data: MdxChapter[]; total: number }>(`/manga/${safeId}/feed`, {
                ...feedParams, offset: 500 * (i + 1),
              }).catch(() => ({ data: [] as MdxChapter[], total: 0 }))
            )
          );
          for (const f of extras) allChapters = allChapters.concat(f.data);
        }

        const base = normalizeMdxManga(m, extractCoverFileName(m));
        const altTitles: string[] = [];
        (m.attributes.altTitles ?? []).forEach((t) => {
          const val = t["en"] ?? t["ja-ro"] ?? Object.values(t)[0];
          if (val && !altTitles.includes(val)) altTitles.push(val);
        });
        const authorRel = m.relationships.find((r) => r.type === "author");
        const authorName = authorRel?.attributes?.["name"] as string | undefined;

        // Deduplicate by chapter number — prefer English when multiple exist
        const chapterMap = new Map<string, MdxChapter>();
        for (const c of allChapters) {
          const n = c.attributes.chapter ?? "0";
          if (!chapterMap.has(n)) {
            chapterMap.set(n, c);
          } else if (c.attributes.translatedLanguage === "en") {
            chapterMap.set(n, c); // Prefer English over other languages
          }
        }
        const chapters = [...chapterMap.values()]
          .sort((a, b) => parseFloat(b.attributes.chapter ?? "0") - parseFloat(a.attributes.chapter ?? "0"))
          .map((c) => ({ id: c.id, number: c.attributes.chapter ?? "0", title: c.attributes.title ?? null, releasedAt: c.attributes.publishAt ?? null, views: null as null }));

        const description = m.attributes.description?.["en"] ?? Object.values(m.attributes.description ?? {})[0] ?? null;

        return {
          id: m.id, title: base.title, coverImage: base.coverImage, bannerImage: null, provider: "mangadex",
          type: base.type, status: base.status, rating: base.rating, description, genres: base.genres,
          author: authorName ?? null, artist: null, chapters, totalChapters: chapters.length,
          alternativeTitles: altTitles.slice(0, 5), serialization: null, updatedAt: null,
        };
      });

      res.json(result);
    } catch (err) {
      req.log.error({ err, id: safeId }, "MangaDex series failed");
      res.status(404).json({ error: "Series not found" });
    }
    return;
  }

  // Non-MangaDex: safeId is the manga page URL from the source site
  // chapters API takes { url: mangaPageUrl, source?: scraperName }
  const mangaUrl = safeId; // The ID IS the manga URL for comick sources
  const scraperName = getScraperNameFromSource(safeProvider);

  try {
    const data = await comickPost<ChaptersResponse>("/api/chapters", { url: mangaUrl, source: scraperName });
    const chaptersRaw = data.chapters ?? [];

    const seenNums = new Set<string>();
    const chapters = chaptersRaw
      .filter((c) => {
        const n = String(c.number ?? "0");
        if (seenNums.has(n)) return false;
        seenNums.add(n);
        return true;
      })
      .map((c) => ({
        id: c.url, // Chapter ID = chapter page URL
        number: String(c.number ?? "0"),
        title: c.title ?? null,
        releasedAt: c.lastUpdated ?? null,
        views: null as null,
      }))
      .sort((a, b) => parseFloat(b.number) - parseFloat(a.number));

    res.json({
      id: safeId, title: safeId, coverImage: "", bannerImage: null,
      provider: safeProvider, type: inferTypeFromSource(safeProvider), status: null,
      rating: null, description: null, genres: [], author: null, artist: null,
      chapters, totalChapters: chapters.length, alternativeTitles: [], serialization: null, updatedAt: null,
    });
  } catch (err) {
    req.log.error({ err, id: safeId, source: safeProvider }, "Comick series failed");
    res.status(404).json({ error: "Series not found" });
  }
});

// GET /manga/chapters/:provider/:seriesId/:chapterId
router.get("/manga/chapters/:provider/:seriesId/:chapterId", async (req, res): Promise<void> => {
  const safeProvider = decodeURIComponent(Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider ?? "mangadex");
  const safeSeriesId = decodeURIComponent(Array.isArray(req.params.seriesId) ? req.params.seriesId[0] : req.params.seriesId ?? "");
  const safeChapterId = decodeURIComponent(Array.isArray(req.params.chapterId) ? req.params.chapterId[0] : req.params.chapterId ?? "");

  if (safeProvider === "mangadex") {
    // Check full-response cache — chapter pages never change after publication
    const chCacheKey = `mdx:chpages:${safeChapterId}`;
    const chCached = _apiCache.get(chCacheKey);
    if (chCached && Date.now() < chCached.expiresAt) {
      res.setHeader("X-Cache", "HIT");
      res.json(chCached.data);
      return;
    }

    try {
      // All 4 calls in parallel — feed + title use sub-caches so repeat chapter loads are instant
      const [serverRes, chapterRes, feedRes, mangaRes] = await Promise.all([
        mdx<{ baseUrl: string; chapter: { hash: string; data: string[]; dataSaver: string[] } }>(`/at-home/server/${safeChapterId}`),
        mdx<{ data: MdxChapter }>(`/chapter/${safeChapterId}`),
        withCache(`mdx:feed:${safeSeriesId}`, 30 * 60 * 1000, () =>
          mdx<{ data: MdxChapter[]; total: number }>(`/manga/${safeSeriesId}/feed`, {
            limit: 500, "translatedLanguage[]": ["en"], "order[chapter]": "desc",
            "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
          })
        ),
        withCache(`mdx:title:${safeSeriesId}`, 60 * 60 * 1000, () =>
          mdx<{ data: MdxManga }>(`/manga/${safeSeriesId}`, { "includes[]": ["cover_art"] })
        ),
      ]);

      const { baseUrl, chapter } = serverRes;
      const pages = chapter[MDX_QUALITY].map((file) => `${baseUrl}/${MDX_QUALITY}/${chapter.hash}/${file}`);
      const currentChapter = chapterRes.data.attributes.chapter ?? safeChapterId;

      const allChapters = feedRes.data;
      // Deduplicate same chapter numbers (same as series detail endpoint)
      const seenNums = new Set<string>();
      const dedupedChapters = allChapters.filter((c) => {
        const n = c.attributes.chapter ?? "0";
        if (seenNums.has(n)) return false;
        seenNums.add(n);
        return true;
      });
      const idx = dedupedChapters.findIndex((c) => c.id === safeChapterId);
      const prevChapterId = idx >= 0 && idx < dedupedChapters.length - 1 ? dedupedChapters[idx + 1].id : null;
      const nextChapterId = idx > 0 ? dedupedChapters[idx - 1].id : null;

      const seriesTitle = mangaRes.data.attributes.title["en"] ?? Object.values(mangaRes.data.attributes.title)[0] ?? "";

      const response = {
        seriesId: safeSeriesId, chapterId: safeChapterId, provider: "mangadex",
        pages, currentChapter, prevChapterId, nextChapterId,
        seriesTitle, chapterTitle: chapterRes.data.attributes.title ?? null,
      };

      // Cache chapter pages for 2 hours — images never change after publication
      _apiCache.set(chCacheKey, { data: response, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });

      res.json(response);
    } catch (err) {
      req.log.error({ err }, "MangaDex chapter pages failed");
      res.status(404).json({ error: "Chapter not found" });
    }
    return;
  }

  // Non-MangaDex: try comix.to API v2 for chapter images
  // safeChapterId = chapter page URL from the source site
  // safeSeriesId = manga page URL from the source site
  const chapterUrl = safeChapterId;
  const mangaUrl = safeSeriesId;
  const scraperName = getScraperNameFromSource(safeProvider);

  try {
    // Attempt comix.to API v2 for images (chapter_id extracted from URL)
    let pages: string[] = [];

    if (safeProvider === "comix" || chapterUrl.includes("comix.to")) {
      const chapterIdMatch = chapterUrl.match(/\/(\d+)-chapter-/);
      if (chapterIdMatch) {
        const comixChapterId = chapterIdMatch[1];
        try {
          const chapterData = await fetch(`https://comix.to/api/v2/chapter/${comixChapterId}/images`, {
            headers: { "User-Agent": "ShiroScans/2.0" },
            signal: AbortSignal.timeout(10000),
          }).then((r) => (r.ok ? r.json() as Promise<{ result?: unknown[] }> : null));
          if (chapterData?.result && Array.isArray(chapterData.result)) {
            pages = chapterData.result.map((img) => {
              const i = img as { url?: string; url2?: string };
              return i.url || i.url2 || "";
            }).filter(Boolean);
          }
        } catch {
          // fall through to chapters list approach
        }
      }
    }

    // Get sibling chapters for prev/next navigation
    const chaptersData = await comickPost<ChaptersResponse>("/api/chapters", { url: mangaUrl, source: scraperName });
    const allChapters = chaptersData.chapters ?? [];
    const idx = allChapters.findIndex((c) => c.url === chapterUrl);

    // Extract chapter number from URL or chapter data
    const currentChapterData = allChapters[idx];
    const currentChapter = currentChapterData ? String(currentChapterData.number) : "?";
    const prevChapterId = idx >= 0 && idx < allChapters.length - 1 ? allChapters[idx + 1].url : null;
    const nextChapterId = idx > 0 ? allChapters[idx - 1].url : null;

    if (pages.length === 0) {
      // Return guidance to open in source site if we can't get images
      pages = [];
    }

    res.json({
      seriesId: safeSeriesId, chapterId: safeChapterId, provider: safeProvider,
      pages, currentChapter, prevChapterId, nextChapterId,
      seriesTitle: "", chapterTitle: currentChapterData?.title ?? null,
      sourceUrl: chapterUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Comick chapter pages failed");
    res.status(404).json({ error: "Chapter not found" });
  }
});

// GET /manga/random
router.get("/manga/random", async (req, res): Promise<void> => {
  const provider = req.query.provider ? String(req.query.provider) : "mangadex";
  if (provider !== "mangadex") {
    try {
      const data = await comickPost<FrontpageResponse>("/api/frontpage", {
        source: provider, section: "trending", page: 1, limit: 30, days: 7,
      });
      const raw = data.section?.items ?? [];
      if (raw.length > 0) {
        res.json(normalizeComickItem(raw[Math.floor(Math.random() * raw.length)], provider));
        return;
      }
    } catch { /* fall through */ }
  }
  try {
    const data = await mdx<{ data: MdxManga }>("/manga/random", { "includes[]": ["cover_art"], "contentRating[]": ["safe", "suggestive"] });
    res.json(normalizeMdxManga(data.data, extractCoverFileName(data.data)));
  } catch (err) {
    req.log.error({ err }, "Random manga failed");
    res.status(500).json({ error: "Failed to fetch random manga" });
  }
});

// ─── Tag cache (avoids redundant MangaDex tag fetches) ───────────────────────

let _tagCache: Array<{ id: string; name: string }> | null = null;

async function getMdxTagId(genreName: string): Promise<string | undefined> {
  if (!_tagCache) {
    try {
      const data = await mdx<{ data: Array<{ id: string; attributes: { name: Record<string, string>; group: string } }> }>("/manga/tag");
      _tagCache = data.data
        .filter((t) => t.attributes.group === "genre")
        .map((t) => ({ id: t.id, name: t.attributes.name["en"] ?? Object.values(t.attributes.name)[0] }));
    } catch {
      _tagCache = [];
    }
  }
  const lower = genreName.toLowerCase();
  return _tagCache.find((t) => t.name.toLowerCase() === lower)?.id;
}

// GET /manga/tags
router.get("/manga/tags", async (_req, res): Promise<void> => {
  try {
    const data = await mdx<{ data: Array<{ id: string; attributes: { name: Record<string, string>; group: string } }> }>("/manga/tag");
    const tags = data.data
      .filter((t) => t.attributes.group === "genre")
      .map((t) => ({ id: t.id, name: t.attributes.name["en"] ?? Object.values(t.attributes.name)[0] }));
    res.json(tags);
  } catch {
    const fallback = [
      "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance",
      "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Isekai",
      "Martial Arts", "Mecha", "School Life", "Psychological", "Historical", "Harem",
      "Reverse Harem", "Villainess", "System", "Cultivation", "Tower",
    ];
    res.json(fallback.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, "-"), name })));
  }
});

// ─── Image proxy allowlist ────────────────────────────────────────────────────
// Only hosts in this set may be requested through the proxy.
// This prevents SSRF against internal services.
//
// Hosts in BROWSER_DIRECT_HOSTS get a 302 redirect (bot-protection blocks
// datacenter IPs, but browsers can load these directly with CORS).
// All others are proxied server-side (needed for Referer-restricted scrapers).

// Browser-direct hosts: browser fetches these directly via 302 redirect
// Kept empty — all images are now proxied server-side for caching + reliability
const BROWSER_DIRECT_HOSTS = new Set<string>([]);

const PROXY_ALLOWED_HOSTS = new Set([
  // MangaDex
  "uploads.mangadex.org",
  "cmdxd98sb0x3yprd.mangadex.network",
  // Comick / comix.to
  "meo.comick.pictures",
  "comick.pictures",
  // AsuraScans
  "gg.asuracomic.net",
  "asuratoon.com",
  "asuracomic.net",
  // WeebCentral
  "weebcentral.com",
  "s1.weebcentral.com",
  "s2.weebcentral.com",
  // MangaGo
  "imgv2-1-f.scribdassets.com",
  "imgv2-2-f.scribdassets.com",
  // MangaKatana
  "mangakatana.com",
  "i.mangakatana.com",
  // AsuraScans CDN
  "asurascans.com",
  "cdn.asurascans.com",
  "img.asurascans.com",
  // Thunderscans
  "api.thunderscans.com",
  "thunderscans.com",
  // Vortex Scans
  "vortexscans.org",
  // Raven Scans
  "ravenscans.com",
  // MangaRead
  "mangaread.org",
  // Mgeko
  "mgeko.cc",
  // Novelcool
  "novelcool.com",
  // Various CDNs commonly used by scrapers
  "i0.wp.com",
  "i1.wp.com",
  "i2.wp.com",
  "i3.wp.com",
  // MangaFire CDN
  "mfcdn.nl",
  "s.mfcdn.nl",
  "static.mfcdn.nl",
  "img.mfcdn.nl",
]);

// GET /proxy-image?url=<encoded-url>  — server-side image proxy so covers always load regardless of CORS/referer restrictions
router.get("/proxy-image", async (req, res): Promise<void> => {
  let rawUrl = String(req.query.url ?? "");
  if (!rawUrl) { res.status(400).end(); return; }
  if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    res.status(400).end();
    return;
  }

  // Parse and validate the URL — reject anything not on the allowlist
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).end();
    return;
  }

  // Only allow https (no http to avoid mixed-content / cleartext leaks)
  if (parsed.protocol !== "https:") {
    res.status(400).end();
    return;
  }

  // Strict hostname allowlist — block any host not explicitly permitted
  // MangaDex at-home CDN hostnames are dynamic (each chapter may use a different node),
  // so we also allow any *.mangadex.org and *.mangadex.network hostname.
  function isAllowedProxyHost(h: string): boolean {
    if (PROXY_ALLOWED_HOSTS.has(h)) return true;
    if (h === "mangadex.org" || h.endsWith(".mangadex.org")) return true;
    if (h.endsWith(".mangadex.network")) return true;
    if (h === "mfcdn.nl" || h.endsWith(".mfcdn.nl")) return true;
    return false;
  }
  if (!isAllowedProxyHost(parsed.hostname)) {
    res.status(403).end();
    return;
  }

  // For browser-friendly CDNs, redirect — let the browser fetch directly
  if (BROWSER_DIRECT_HOSTS.has(parsed.hostname)) {
    res.redirect(302, rawUrl);
    return;
  }

  // Check in-memory image cache first
  const cacheKey = rawUrl;
  const cached = _imgCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < IMG_CACHE_TTL) {
    res.setHeader("Content-Type", cached.ct);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Cache", "HIT");
    res.status(200).send(cached.buf);
    return;
  }

  try {
    const referer = rawUrl.includes("asurascans.com") ? "https://asurascans.com/" :
                    rawUrl.includes("asura") ? "https://asuracomic.net/" :
                    rawUrl.includes("weebcentral") ? "https://weebcentral.com/" :
                    rawUrl.includes("mangafire") ? "https://mangafire.to/" :
                    rawUrl.includes("mangadex") ? "https://mangadex.org/" :
                    rawUrl.includes("mangadex.network") ? "https://mangadex.org/" :
                    rawUrl.includes("mangadex.org") ? "https://mangadex.org/" :
                    "https://mangadex.org/";
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "image/webp,image/avif,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      res.status(400).end();
      return;
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    // Store in memory cache
    _imgCache.set(cacheKey, { buf: buffer, ct: contentType, ts: Date.now() });
    pruneImgCache();
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Cache", "MISS");
    res.status(200).send(buffer);
  } catch (err) {
    req.log.error({ err }, "Image proxy failed");
    res.status(502).end();
  }
});

export default router;
