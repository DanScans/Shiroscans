import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── TTL in-memory cache ──────────────────────────────────────────────────────
const _flameCache = new Map<string, { data: unknown; expiresAt: number }>();
function withFlameCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _flameCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    _flameCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

const FLAME_DOMAIN = "https://flamecomics.xyz";
const FLAME_CDN = "https://cdn.flamecomics.xyz";
const IMAGE_SERIES_PATH = "uploads/images/series";
const IMAGE_CAROUSEL_PATH = "uploads/images/carousel";

let _buildId = "";
let _buildIdFetchedAt = 0;
const BUILD_ID_TTL_MS = 15 * 60 * 1000;

const FLAME_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": `${FLAME_DOMAIN}/`,
  "Origin": FLAME_DOMAIN,
  "Accept": "application/json, text/html, */*",
};

function extractBuildId(html: string): string {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!m?.[1]) throw new Error("__NEXT_DATA__ not found");
  const nd = JSON.parse(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
  if (!nd.buildId) throw new Error("buildId missing");
  return nd.buildId;
}

async function getBuildId(force = false): Promise<string> {
  const now = Date.now();
  if (!force && _buildId && now - _buildIdFetchedAt < BUILD_ID_TTL_MS) return _buildId;
  const res = await fetch(FLAME_DOMAIN, { headers: FLAME_HEADERS });
  if (!res.ok) throw new Error(`FlameComics homepage returned ${res.status}`);
  const html = await res.text();
  _buildId = extractBuildId(html);
  _buildIdFetchedAt = now;
  return _buildId;
}

async function flameJson(path: string): Promise<unknown> {
  const buildId = await getBuildId();
  const url = `${FLAME_DOMAIN}/_next/data/${buildId}/${path}`;
  let res = await fetch(url, { headers: FLAME_HEADERS });
  if (res.status === 404) {
    const freshId = await getBuildId(true);
    const url2 = `${FLAME_DOMAIN}/_next/data/${freshId}/${path}`;
    res = await fetch(url2, { headers: FLAME_HEADERS });
  }
  if (!res.ok) throw new Error(`FlameComics API ${path} returned ${res.status}`);
  return res.json() as Promise<unknown>;
}

function getPageProps(payload: unknown): Record<string, any> {
  const p = (payload as { pageProps?: unknown }).pageProps;
  if (!p || typeof p !== "object") throw new Error("Missing pageProps");
  return p as Record<string, any>;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function cleanText(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function seriesImageUrl(seriesId: string, cover: string) {
  return `${FLAME_CDN}/${IMAGE_SERIES_PATH}/${seriesId}/${cover}`;
}

function carouselImageUrl(img: string) {
  return `${FLAME_CDN}/${IMAGE_CAROUSEL_PATH}/${img}`;
}

function chapterImageUrl(seriesId: string, token: string, name: string) {
  return `${FLAME_CDN}/${IMAGE_SERIES_PATH}/${seriesId}/${token}/${name}`;
}

function normalizeStatus(s: unknown): string {
  const v = cleanText(s).toLowerCase();
  if (v.includes("ongoing")) return "Ongoing";
  if (v.includes("complete")) return "Completed";
  if (v.includes("hiatus")) return "Hiatus";
  if (v.includes("drop")) return "Dropped";
  return cleanText(s) || "Ongoing";
}

function mapSeriesPreview(comic: any, sourceType: "series" | "carousel" = "series") {
  const id = String(comic.series_id ?? comic.id ?? "");
  const cover = sourceType === "carousel"
    ? carouselImageUrl(String(comic.image ?? ""))
    : seriesImageUrl(id, String(comic.cover ?? ""));
  return {
    id,
    sourceId: "flamecomics",
    title: cleanText(comic.title),
    coverUrl: cover,
    status: normalizeStatus(comic.status),
    latestChapter: comic.last_chapter ? Number(comic.last_chapter) : undefined,
    genres: asArray<string>(comic.categories).map(cleanText),
    rating: comic.likes != null ? undefined : undefined,
  };
}

// GET /api/flamecomics/home
router.get("/flamecomics/home", async (_req, res): Promise<void> => {
  try {
    const payload = await flameJson("index.json");
    const pp = getPageProps(payload);

    const carousel = asArray<any>(pp.carousel)
      .filter((c) => c.series_id != null && c.image)
      .map((c) => mapSeriesPreview(c, "carousel"));

    const popular = asArray<any>(pp.popularEntries?.blocks?.[0]?.series ?? [])
      .filter((c) => c.series_id != null && c.cover)
      .map((c) => mapSeriesPreview(c));

    const latest = asArray<any>(pp.latestEntries?.blocks?.[0]?.series ?? [])
      .filter((c) => c.series_id != null && c.cover)
      .map((c) => mapSeriesPreview(c));

    res.json({ featured: carousel, popular, latest });
  } catch (err) {
    console.error("[FlameComics] home error:", err);
    res.status(502).json({ error: "Failed to fetch FlameComics home" });
  }
});

// GET /api/flamecomics/series/:id
router.get("/flamecomics/series/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  if (!id) { res.status(400).json({ error: "id required" }); return; }

  try {
    const result = await withFlameCache(`series:${id}`, 10 * 60 * 1000, async () => {
      const path = `series/${encodeURIComponent(id)}.json?id=${encodeURIComponent(id)}`;
      const payload = await flameJson(path);
      const pp = getPageProps(payload);
      const s = pp.series;
      if (!s) throw new Error("Series not found");

      const cover = s.cover ? seriesImageUrl(id, String(s.cover)) : "";
      const chapters = asArray<any>(pp.chapters).map((ch) => ({
        id: String(ch.chapter_id),
        token: String(ch.token ?? ""),
        number: parseFloat(String(ch.chapter)),
        title: cleanText(ch.title ?? ""),
        releaseDate: ch.release_date ? new Date(Number(ch.release_date) * 1000).toISOString() : null,
      }));

      return {
        id,
        sourceId: "flamecomics",
        title: cleanText(s.title),
        coverUrl: cover,
        description: cleanText(s.description),
        author: cleanText(s.author),
        artist: cleanText(s.artist),
        status: normalizeStatus(s.status),
        genres: asArray<string>(s.tags).map(cleanText),
        altTitles: asArray<string>(s.altTitles).map(cleanText),
        totalChapters: chapters.length,
        chapters,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(`[FlameComics] series ${id} error:`, err);
    res.status(502).json({ error: "Failed to fetch series" });
  }
});

// GET /api/flamecomics/chapters/:seriesId/:chapterId
// Requires token query param (from series chapter list)
router.get("/flamecomics/chapters/:seriesId/:chapterId", async (req, res): Promise<void> => {
  const { seriesId, chapterId } = req.params;
  const token = req.query.token ? String(req.query.token) : null;

  if (!seriesId || !chapterId) { res.status(400).json({ error: "seriesId and chapterId required" }); return; }

  // Check full response cache first — chapter pages never change after publication
  const chCacheKey = `chapter:${seriesId}:${chapterId}`;
  const chCached = _flameCache.get(chCacheKey);
  if (chCached && Date.now() < chCached.expiresAt) {
    res.json(chCached.data);
    return;
  }

  try {
    // Fetch series data (cached) to resolve token + get prev/next chapter navigation
    const seriesPath = `series/${encodeURIComponent(seriesId)}.json?id=${encodeURIComponent(seriesId)}`;
    const seriesPayload = await withFlameCache(`flame-series-raw:${seriesId}`, 10 * 60 * 1000, () => flameJson(seriesPath));
    const seriesPp = getPageProps(seriesPayload as Record<string, any>);
    const allChapters = asArray<any>(seriesPp.chapters);
    const seriesTitle = cleanText(seriesPp.series?.title ?? "");

    let resolvedToken = token;
    if (!resolvedToken) {
      const ch = allChapters.find((c: any) => String(c.chapter_id) === chapterId);
      if (!ch?.token) { res.status(404).json({ error: "Chapter token not found" }); return; }
      resolvedToken = String(ch.token);
    }

    // Get chapter pages (cached)
    const chPath = `series/${encodeURIComponent(seriesId)}/${encodeURIComponent(resolvedToken)}.json?id=${encodeURIComponent(seriesId)}&token=${encodeURIComponent(resolvedToken)}`;
    const payload = await withFlameCache(`flame-chraw:${seriesId}:${resolvedToken}`, 2 * 60 * 60 * 1000, () => flameJson(chPath));
    const pp = getPageProps(payload as Record<string, any>);
    const chapter = pp.chapter;
    if (!chapter) { res.status(404).json({ error: "Chapter not found" }); return; }

    const images = Object.values(chapter.images ?? {}) as Array<{ name?: string; index?: number }>;
    const sortedImages = images
      .map((img, i) => ({ name: img.name, index: img.index ?? i }))
      .filter((img): img is { name: string; index: number } => Boolean(img.name))
      .sort((a, b) => a.index - b.index);
    const pages = sortedImages.map(({ name }) => chapterImageUrl(seriesId, resolvedToken!, name));

    // Build prev/next navigation from sorted chapters list
    // Chapters sorted ascending by chapter number → prev = lower, next = higher
    const sortedChapters = [...allChapters].sort((a: any, b: any) => parseFloat(String(a.chapter)) - parseFloat(String(b.chapter)));
    const idx = sortedChapters.findIndex((c: any) => String(c.chapter_id) === chapterId);
    const prevChapter = idx > 0 ? sortedChapters[idx - 1] : null;
    const nextChapter = idx >= 0 && idx < sortedChapters.length - 1 ? sortedChapters[idx + 1] : null;
    const currentChapterNum = idx >= 0 ? String(parseFloat(String(sortedChapters[idx]?.chapter ?? chapterId))) : chapterId;

    const response = {
      id: chapterId,
      seriesId,
      seriesTitle,
      pages,
      currentChapter: currentChapterNum,
      prevChapterId: prevChapter ? String(prevChapter.chapter_id) : null,
      prevToken: prevChapter ? String(prevChapter.token ?? "") : null,
      nextChapterId: nextChapter ? String(nextChapter.chapter_id) : null,
      nextToken: nextChapter ? String(nextChapter.token ?? "") : null,
    };

    // Cache full response for 2 hours
    _flameCache.set(chCacheKey, { data: response, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });

    res.json(response);
  } catch (err) {
    console.error(`[FlameComics] chapter ${seriesId}/${chapterId} error:`, err);
    res.status(502).json({ error: "Failed to fetch chapter pages" });
  }
});

// GET /api/flamecomics/search?q=
router.get("/flamecomics/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q) { res.json({ results: [] }); return; }

  try {
    const path = `browse.json?search=${encodeURIComponent(q)}`;
    const payload = await flameJson(path);
    const pp = getPageProps(payload);

    const lower = q.toLowerCase();
    const results = asArray<any>(pp.series)
      .filter((c) => {
        if (!c.series_id || !c.cover) return false;
        return !q || cleanText(c.title).toLowerCase().includes(lower);
      })
      .map((c) => mapSeriesPreview(c));

    res.json({ results });
  } catch (err) {
    console.error("[FlameComics] search error:", err);
    res.status(502).json({ error: "Search failed" });
  }
});

// GET /api/flamecomics/browse?genre=&status=&page=
router.get("/flamecomics/browse", async (req, res): Promise<void> => {
  const genre = req.query.genre ? String(req.query.genre).toLowerCase() : null;
  const status = req.query.status ? String(req.query.status).toLowerCase() : null;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 24;

  try {
    const path = `browse.json?search=`;
    const payload = await flameJson(path);
    const pp = getPageProps(payload);

    let items = asArray<any>(pp.series)
      .filter((c) => c.series_id != null && c.cover)
      .map((c) => mapSeriesPreview(c));

    if (genre) {
      items = items.filter((item) =>
        item.genres.some((g: string) => g.toLowerCase() === genre)
      );
    }
    if (status) {
      items = items.filter((item) =>
        normalizeStatus(item.status).toLowerCase().includes(status)
      );
    }

    const total = items.length;
    const paged = items.slice((page - 1) * limit, page * limit);
    res.json({ results: paged, total, page, hasMore: page * limit < total });
  } catch (err) {
    console.error("[FlameComics] browse error:", err);
    res.status(502).json({ error: "Browse failed" });
  }
});

export default router;
