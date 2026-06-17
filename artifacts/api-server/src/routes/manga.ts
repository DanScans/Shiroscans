import { Router, type IRouter } from "express";

const router: IRouter = Router();

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

async function comickFetch(endpoint: string, init: RequestInit, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

async function comickPost<T>(endpoint: string, body: unknown, timeoutMs = 25000): Promise<T> {
  const res = await comickFetch(endpoint, { method: "POST", body: JSON.stringify(body) }, timeoutMs);
  if (!res.ok) throw new Error(`Comick API ${endpoint} returned ${res.status}`);
  return res.json() as Promise<T>;
}

async function comickGet<T>(endpoint: string, timeoutMs = 15000): Promise<T> {
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
    flamecomics: "FlameComics",
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

// GET /manga/sources
router.get("/manga/sources", async (_req, res): Promise<void> => {
  try {
    const data = await comickGet("/api/sources");
    res.json(data);
  } catch {
    res.json([
      { id: "comix", name: "Comick", status: "active", type: "aggregator" },
      { id: "mangadex", name: "MangaDex", status: "active", type: "aggregator" },
      { id: "asurascan", name: "AsuraScans", status: "active", type: "scanlation" },
      { id: "weebcentral", name: "WeebCentral", status: "active", type: "aggregator" },
      { id: "mangago", name: "Mangago", status: "active", type: "aggregator" },
      { id: "mangakatana", name: "MangaKatana", status: "active", type: "aggregator" },
    ]);
  }
});

// GET /manga/home — Comick frontpage trending + latest + new, MangaDex as fallback
router.get("/manga/home", async (req, res): Promise<void> => {
  try {
    const [trendingResult, latestResult, newResult, mdxLatestResult, mdxPopularResult] = await Promise.allSettled([
      comickPost<FrontpageResponse>("/api/frontpage", { source: "comix", section: "trending", page: 1, limit: 20, days: 7 }),
      comickPost<FrontpageResponse>("/api/frontpage", { source: "comix", section: "latest_hot", page: 1, limit: 20 }),
      comickPost<FrontpageResponse>("/api/frontpage", { source: "comix", section: "recently_added", page: 1, limit: 12 }),
      mdx<{ data: MdxManga[] }>("/manga", {
        limit: 20, "order[latestUploadedChapter]": "desc", "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": ["en"],
      }),
      mdx<{ data: MdxManga[] }>("/manga", {
        limit: 20, "order[followedCount]": "desc", "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": ["en"],
      }),
    ]);

    const extractComickSection = (result: PromiseSettledResult<FrontpageResponse>, source: string) => {
      if (result.status !== "fulfilled") return [];
      // Correct response shape: { source, sourceName, section: { items: [...] } }
      const items = result.value.section?.items ?? [];
      return items.map((item) => normalizeComickItem(item, source));
    };

    const trendingItems = extractComickSection(trendingResult, "comix");
    const latestItems = extractComickSection(latestResult, "comix");
    const newItems = extractComickSection(newResult, "comix");

    const mdxLatest = mdxLatestResult.status === "fulfilled"
      ? mdxLatestResult.value.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)))
      : [];
    const mdxPopular = mdxPopularResult.status === "fulfilled"
      ? mdxPopularResult.value.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)))
      : [];

    // Use Comick if available, MangaDex as fallback
    const featured = trendingItems.length >= 6 ? trendingItems.slice(0, 6) : mdxPopular.slice(0, 6);
    const latestUpdates = latestItems.length > 0 ? latestItems : mdxLatest;
    const popularNow = trendingItems.length > 0 ? trendingItems : mdxPopular;
    const newSeries = newItems.length > 0 ? newItems : [];

    res.json({ featured, latestUpdates, popularNow, newSeries });
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
  const offset = (page - 1) * 20;

  if (provider === "mangadex") {
    try {
      const params: Record<string, string | string[] | number | boolean | undefined> = {
        limit: 20, offset, "order[latestUploadedChapter]": "desc", "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": ["en"],
      };
      if (status && ["ongoing", "completed", "hiatus", "cancelled"].includes(status)) params["status[]"] = [status];
      const origLangs = typeToOriginalLanguage(type);
      if (origLangs?.length) params["originalLanguage[]"] = origLangs;
      const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", params);
      const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
      res.json({ items, page, hasMore: offset + items.length < data.total });
    } catch (err) {
      req.log.error({ err }, "MangaDex latest failed");
      res.json({ items: [], page, hasMore: false });
    }
    return;
  }

  try {
    const data = await comickPost<FrontpageResponse>("/api/frontpage", {
      source: provider, section: "latest_hot", page, limit: 24,
    });
    const raw = data.section?.items ?? [];
    const items = raw.map((item) => normalizeComickItem(item, provider)).filter((item) => {
      if (status && item.status && item.status.toLowerCase() !== status.toLowerCase()) return false;
      if (type && item.type && item.type.toLowerCase() !== type.toLowerCase()) return false;
      return true;
    });
    res.json({ items, page, hasMore: raw.length >= 24 });
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
  const offset = (page - 1) * 20;

  if (provider === "mangadex") {
    try {
      const params: Record<string, string | string[] | number | boolean | undefined> = {
        limit: 20, offset, "order[followedCount]": "desc", "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": ["en"],
      };
      if (status && ["ongoing", "completed", "hiatus", "cancelled"].includes(status)) params["status[]"] = [status];
      const origLangs = typeToOriginalLanguage(type);
      if (origLangs?.length) params["originalLanguage[]"] = origLangs;
      const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", params);
      const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
      res.json({ items, page, hasMore: offset + items.length < data.total });
    } catch (err) {
      req.log.error({ err }, "MangaDex popular failed");
      res.json({ items: [], page, hasMore: false });
    }
    return;
  }

  try {
    const data = await comickPost<FrontpageResponse>("/api/frontpage", {
      source: provider, section: "trending", page, limit: 24, days: 30,
    });
    const raw = data.section?.items ?? [];
    const items = raw.map((item) => normalizeComickItem(item, provider)).filter((item) => {
      if (status && item.status && item.status.toLowerCase() !== status.toLowerCase()) return false;
      if (type && item.type && item.type.toLowerCase() !== type.toLowerCase()) return false;
      return true;
    });
    res.json({ items, page, hasMore: raw.length >= 24 });
  } catch (err) {
    req.log.error({ err }, "Comick popular failed");
    res.json({ items: [], page, hasMore: false });
  }
});

// GET /manga/search
router.get("/manga/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const provider = req.query.provider ? String(req.query.provider) : "all";
  const offset = (page - 1) * 20;

  if (!q) { res.json({ items: [], page: 1, hasMore: false }); return; }

  if (provider === "mangadex") {
    try {
      const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", {
        title: q, limit: 20, offset, "includes[]": ["cover_art"], "contentRating[]": ["safe", "suggestive"],
      });
      const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
      res.json({ items, page, hasMore: offset + items.length < data.total });
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
      if (url.includes("flamecomics.xyz")) return "flamecomics";
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
      const [mangaRes, feedRes] = await Promise.allSettled([
        mdx<{ data: MdxManga }>(`/manga/${safeId}`, { "includes[]": ["cover_art", "author", "artist"] }),
        mdx<{ data: MdxChapter[]; total: number }>(`/manga/${safeId}/feed`, {
          limit: 500, "translatedLanguage[]": ["en"], "order[chapter]": "desc",
          "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
        }),
      ]);

      if (mangaRes.status === "rejected") { res.status(404).json({ error: "Series not found" }); return; }

      const m = mangaRes.value.data;
      const base = normalizeMdxManga(m, extractCoverFileName(m));
      const altTitles: string[] = [];
      (m.attributes.altTitles ?? []).forEach((t) => {
        const val = t["en"] ?? t["ja-ro"] ?? Object.values(t)[0];
        if (val && !altTitles.includes(val)) altTitles.push(val);
      });
      const authorRel = m.relationships.find((r) => r.type === "author");
      const authorName = authorRel?.attributes?.["name"] as string | undefined;
      const chaptersRaw = feedRes.status === "fulfilled" ? feedRes.value.data : [];
      const seenNums = new Set<string>();
      const chapters = chaptersRaw
        .filter((c) => { const n = c.attributes.chapter ?? "0"; if (seenNums.has(n)) return false; seenNums.add(n); return true; })
        .map((c) => ({ id: c.id, number: c.attributes.chapter ?? "0", title: c.attributes.title ?? null, releasedAt: c.attributes.publishAt ?? null, views: null as null }));
      const description = m.attributes.description?.["en"] ?? Object.values(m.attributes.description ?? {})[0] ?? null;

      res.json({
        id: m.id, title: base.title, coverImage: base.coverImage, bannerImage: null, provider: "mangadex",
        type: base.type, status: base.status, rating: base.rating, description, genres: base.genres,
        author: authorName ?? null, artist: null, chapters, totalChapters: chapters.length,
        alternativeTitles: altTitles.slice(0, 5), serialization: null, updatedAt: null,
      });
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
    try {
      const [serverRes, chapterRes] = await Promise.all([
        mdx<{ baseUrl: string; chapter: { hash: string; data: string[]; dataSaver: string[] } }>(`/at-home/server/${safeChapterId}`),
        mdx<{ data: MdxChapter }>(`/chapter/${safeChapterId}`),
      ]);
      const { baseUrl, chapter } = serverRes;
      const pages = chapter[MDX_QUALITY].map((file) => `${baseUrl}/${MDX_QUALITY}/${chapter.hash}/${file}`);
      const currentChapter = chapterRes.data.attributes.chapter ?? safeChapterId;

      const feedRes = await mdx<{ data: MdxChapter[] }>(`/manga/${safeSeriesId}/feed`, {
        limit: 500, "translatedLanguage[]": ["en"], "order[chapter]": "desc",
        "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
      });
      const allChapters = feedRes.data;
      const idx = allChapters.findIndex((c) => c.id === safeChapterId);
      const prevChapterId = idx >= 0 && idx < allChapters.length - 1 ? allChapters[idx + 1].id : null;
      const nextChapterId = idx > 0 ? allChapters[idx - 1].id : null;

      const mangaRes = await mdx<{ data: MdxManga }>(`/manga/${safeSeriesId}`, { "includes[]": ["cover_art"] });
      const seriesTitle = mangaRes.data.attributes.title["en"] ?? Object.values(mangaRes.data.attributes.title)[0] ?? "";

      res.json({
        seriesId: safeSeriesId, chapterId: safeChapterId, provider: "mangadex",
        pages, currentChapter, prevChapterId, nextChapterId,
        seriesTitle, chapterTitle: chapterRes.data.attributes.title ?? null,
      });
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
          }).then((r) => (r.ok ? r.json() : null));
          if (chapterData?.result && Array.isArray(chapterData.result)) {
            pages = chapterData.result.map((img: { url?: string; url2?: string }) => img.url || img.url2 || "").filter(Boolean);
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

// Domains that browsers can load directly (CORS-friendly CDNs).
// For these we issue a 302 redirect instead of proxying server-side,
// because their bot-protection blocks datacenter IPs.
const BROWSER_DIRECT_HOSTS = new Set([
  "uploads.mangadex.org",
  "cmdxd98sb0x3yprd.mangadex.network",
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

  // For browser-friendly CDNs, redirect — let the browser fetch directly
  try {
    const parsed = new URL(rawUrl);
    if (BROWSER_DIRECT_HOSTS.has(parsed.hostname)) {
      res.redirect(302, rawUrl);
      return;
    }
  } catch {
    res.status(400).end();
    return;
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ShiroScans/2.0) AppleWebKit/537.36",
        "Referer": "https://mangadex.org/",
        "Accept": "image/webp,image/avif,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buffer = await upstream.arrayBuffer();
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    req.log.error({ err }, "Image proxy failed");
    res.status(502).end();
  }
});

export default router;
