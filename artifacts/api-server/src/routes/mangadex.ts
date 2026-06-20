import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const MDX_API = "https://api.mangadex.org";
const MDX_CDN = "https://uploads.mangadex.org";
const MDX_HEADERS: Record<string, string> = {
  "User-Agent": "ShiroScans/1.0 (https://github.com/shiroscans)",
  "Accept": "application/json",
};

const _cache = new Map<string, { data: unknown; expiresAt: number }>();
function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

async function mdxFetch<T>(path: string, params: Record<string, string | string[]> = {}): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${MDX_API}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((val) => url.searchParams.append(k, val));
    else url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: MDX_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`MangaDex ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

interface MDXManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    description: Record<string, string>;
    status: string;
    tags: Array<{ id: string; attributes: { name: Record<string, string> } }>;
    year: number | null;
    contentRating: string;
    lastChapter: string | null;
  };
  relationships: Array<{
    id: string;
    type: string;
    attributes?: {
      fileName?: string;
      name?: string;
    };
  }>;
}

function getTitle(attrs: MDXManga["attributes"]): string {
  return attrs.title.en ?? Object.values(attrs.title)[0] ?? "Unknown Title";
}

function getDesc(attrs: MDXManga["attributes"]): string {
  return attrs.description.en ?? Object.values(attrs.description)[0] ?? "";
}

function getCoverUrl(manga: MDXManga): string {
  const rel = manga.relationships.find((r) => r.type === "cover_art");
  if (!rel?.attributes?.fileName) return "";
  return `${MDX_CDN}/covers/${manga.id}/${rel.attributes.fileName}.256.jpg`;
}

function getAuthor(manga: MDXManga): string {
  const rel = manga.relationships.find((r) => r.type === "author" || r.type === "artist");
  return rel?.attributes?.name ?? "";
}

function formatManga(m: MDXManga) {
  return {
    id: m.id,
    title: getTitle(m.attributes),
    description: getDesc(m.attributes),
    coverUrl: getCoverUrl(m),
    author: getAuthor(m),
    status: m.attributes.status,
    year: m.attributes.year,
    genres: m.attributes.tags.map((t) => t.attributes.name.en ?? "").filter(Boolean).slice(0, 5),
    lastChapter: m.attributes.lastChapter ?? null,
    contentRating: m.attributes.contentRating,
  };
}

const COMMON_INCLUDES = ["cover_art", "author", "artist"];
const SAFE_RATINGS = ["safe", "suggestive"];

async function fetchPopularManga(page: number, limit = 30) {
  const offset = (page - 1) * limit;
  const data = await mdxFetch<{ data: MDXManga[]; total: number }>("/manga", {
    limit: String(limit),
    offset: String(offset),
    "contentRating[]": SAFE_RATINGS,
    "order[followedCount]": "desc",
    "includes[]": COMMON_INCLUDES,
    hasAvailableChapters: "true",
  });
  return {
    results: data.data.map(formatManga),
    total: data.total,
    page,
    totalPages: Math.ceil(data.total / limit),
    hasMore: offset + limit < data.total,
  };
}

async function fetchLatestManga(limit = 30) {
  const data = await mdxFetch<{ data: MDXManga[] }>("/manga", {
    limit: String(limit),
    "contentRating[]": SAFE_RATINGS,
    "order[latestUploadedChapter]": "desc",
    "includes[]": COMMON_INCLUDES,
    hasAvailableChapters: "true",
  });
  return data.data.map(formatManga);
}

// GET /api/mangadex/home
router.get("/mangadex/home", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [popularData, latestItems] = await Promise.all([
      withCache("mdx:popular:1", 10 * 60 * 1000, () => fetchPopularManga(1, 50)),
      withCache("mdx:latest", 5 * 60 * 1000, () => fetchLatestManga(30)),
    ]);
    res.json({
      featured: popularData.results.slice(0, 10),
      popular: popularData.results,
      latest: latestItems,
    });
  } catch (err) {
    console.error("[MangaDex] home error:", err);
    res.status(502).json({ error: "Failed to fetch MangaDex home", featured: [], popular: [], latest: [] });
  }
});

// GET /api/mangadex/popular?page=1
router.get("/mangadex/popular", async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  try {
    const data = await withCache(`mdx:popular:${page}`, 10 * 60 * 1000, () => fetchPopularManga(page));
    res.json(data);
  } catch (err) {
    console.error("[MangaDex] popular error:", err);
    res.status(502).json({ error: "Failed", results: [], page: 1, totalPages: 1, hasMore: false });
  }
});

// GET /api/mangadex/series/:mangaId
router.get("/mangadex/series/:mangaId", async (req: Request, res: Response): Promise<void> => {
  const { mangaId } = req.params;
  if (!mangaId) { res.status(400).json({ error: "invalid mangaId" }); return; }

  try {
    const data = await withCache(`mdx:series:${mangaId}`, 10 * 60 * 1000, async () => {
      const [mangaRes, chaptersRes] = await Promise.all([
        mdxFetch<{ data: MDXManga }>(`/manga/${mangaId}`, { "includes[]": COMMON_INCLUDES }),
        mdxFetch<{ data: Array<{ id: string; attributes: { chapter: string | null; title: string | null; volume: string | null; publishAt: string; externalUrl: string | null; pages: number } }> }>(`/manga/${mangaId}/feed`, {
          limit: "500",
          translatedLanguage: ["en"],
          "order[chapter]": "asc",
          "contentRating[]": SAFE_RATINGS,
          "includes[]": ["scanlation_group"],
        }),
      ]);

      const manga = formatManga(mangaRes.data);
      const seen = new Set<string>();
      const chapters = chaptersRes.data
        .filter((c) => {
          if (c.attributes.externalUrl) return false;
          const key = c.attributes.chapter ?? c.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c) => ({
          id: c.id,
          chapter: c.attributes.chapter,
          title: c.attributes.title,
          volume: c.attributes.volume,
          publishAt: c.attributes.publishAt,
          pages: c.attributes.pages,
        }))
        .reverse(); // newest first

      return { ...manga, chapters };
    });
    res.json(data);
  } catch (err) {
    console.error(`[MangaDex] series ${mangaId} error:`, err);
    res.status(502).json({ error: "Failed to fetch series" });
  }
});

// GET /api/mangadex/chapters/:chapterId
router.get("/mangadex/chapters/:chapterId", async (req: Request, res: Response): Promise<void> => {
  const { chapterId } = req.params;
  if (!chapterId) { res.status(400).json({ error: "invalid chapterId" }); return; }

  try {
    const data = await withCache(`mdx:chapter:${chapterId}`, 60 * 60 * 1000, async () => {
      const atHomeRes = await mdxFetch<{
        baseUrl: string;
        chapter: { hash: string; data: string[]; dataSaver: string[] };
      }>(`/at-home/server/${chapterId}`);
      const { baseUrl, chapter } = atHomeRes;
      const pages = chapter.data.map((f) => ({
        url: `${baseUrl}/data/${chapter.hash}/${f}`,
        filename: f,
      }));
      return { chapterId, pages };
    });
    res.json(data);
  } catch (err) {
    console.error(`[MangaDex] chapter ${chapterId} error:`, err);
    res.status(502).json({ error: "Failed to fetch chapter", pages: [] });
  }
});

// GET /api/mangadex/search?q=
router.get("/mangadex/search", async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q) { res.json({ results: [] }); return; }

  try {
    const data = await mdxFetch<{ data: MDXManga[] }>("/manga", {
      title: q,
      limit: "20",
      "contentRating[]": SAFE_RATINGS,
      "includes[]": COMMON_INCLUDES,
    });
    res.json({ results: data.data.map(formatManga) });
  } catch (err) {
    console.error("[MangaDex] search error:", err);
    res.status(502).json({ error: "Search failed", results: [] });
  }
});

// GET /api/mangadex/chapter-images?title=&chapter=
// Resolves WeebCentral (or any) series title + chapter number → MangaDex image URLs.
// Used as a fallback when the primary source cannot serve images server-side.
router.get("/mangadex/chapter-images", async (req: Request, res: Response): Promise<void> => {
  const title = String(req.query.title ?? "").trim();
  const chapterRaw = String(req.query.chapter ?? "").trim();
  if (!title || !chapterRaw) { res.status(400).json({ error: "title and chapter are required", pages: [] }); return; }

  const cacheKey = `mdx:ci:${title.toLowerCase()}:${chapterRaw}`;
  try {
    const data = await withCache(cacheKey, 30 * 60 * 1000, async () => {
      // 1. Search for the manga by title
      const searchRes = await mdxFetch<{ data: MDXManga[] }>("/manga", {
        title,
        limit: "5",
        "contentRating[]": ["safe", "suggestive", "erotica"],
        "includes[]": [],
        hasAvailableChapters: "true",
      });

      if (!searchRes.data.length) return { pages: [] };

      // Pick the best match: prefer exact (case-insensitive) title match, else first result
      const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const target = normalise(title);
      const best = searchRes.data.find((m) =>
        Object.values(m.attributes.title).some((t) => normalise(t) === target)
      ) ?? searchRes.data[0];

      const mangaId = best.id;

      // 2. Fetch chapter feed.
      // NOTE: chapter= filter causes 400 on MangaDex; URLSearchParams percent-encodes brackets
      // but MangaDex accepts them. Build URL manually to control offset precisely.
      const chapterNum = parseFloat(chapterRaw);
      type FeedChapter = { id: string; attributes: { chapter: string | null; externalUrl: string | null; pages: number } };

      // Fetch up to 40 chapters starting near the target chapter (offset-based)
      const estimatedOffset = Math.max(0, Math.floor(chapterNum) - 5);
      const feedUrl = `${MDX_API}/manga/${mangaId}/feed?limit=40&offset=${estimatedOffset}&translatedLanguage[]=en&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive`;
      const feedRaw = await fetch(feedUrl, { headers: MDX_HEADERS, signal: AbortSignal.timeout(20000) });
      if (!feedRaw.ok) throw new Error(`MangaDex feed returned ${feedRaw.status}`);
      const feedRes = await feedRaw.json() as { data: FeedChapter[]; total: number };

      // Filter out external-only chapters with no pages
      const valid = feedRes.data.filter((c: FeedChapter) => !c.attributes.externalUrl && (c.attributes.pages ?? 0) > 0);
      if (!valid.length) return { pages: [] as string[] };

      // Pick the chapter whose number is closest to the requested one
      const best2 = valid.reduce((prev: FeedChapter, curr: FeedChapter) => {
        const pd = Math.abs(parseFloat(prev.attributes.chapter ?? "0") - chapterNum);
        const cd = Math.abs(parseFloat(curr.attributes.chapter ?? "0") - chapterNum);
        return cd < pd ? curr : prev;
      });

      // 3. Get at-home server
      const atHome = await mdxFetch<{
        baseUrl: string;
        chapter: { hash: string; data: string[] };
      }>(`/at-home/server/${best2.id}`);

      const pages = atHome.chapter.data.map(
        (f) => `${atHome.baseUrl}/data/${atHome.chapter.hash}/${f}`,
      );

      return { mangaId, mdxChapterId: best2.id, pages };
    });

    res.json(data);
  } catch (err) {
    console.error("[MangaDex] chapter-images error:", err);
    res.status(502).json({ error: "Failed to resolve chapter images", pages: [] });
  }
});

// GET /api/mangadex/proxy-image?url=  – proxy MangaDex CDN images (avoids CORS)
router.get("/mangadex/proxy-image", async (req: Request, res: Response): Promise<void> => {
  const url = String(req.query.url ?? "");
  if (!url.startsWith("http") || (!url.includes("mangadex.org") && !url.includes("mangadex.network"))) {
    res.status(400).end();
    return;
  }
  try {
    const imgRes = await fetch(url, {
      headers: { "Referer": "https://mangadex.org/", "User-Agent": MDX_HEADERS["User-Agent"] ?? "" },
      signal: AbortSignal.timeout(20000),
    });
    if (!imgRes.ok) { res.status(imgRes.status).end(); return; }
    const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
    res.set("Content-Type", ct.includes("image/") ? ct : "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error("[MangaDex] image proxy error:", err);
    res.status(502).end();
  }
});

export default router;
