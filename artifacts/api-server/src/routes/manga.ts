import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ─── Source API base URLs ────────────────────────────────────────────────────
const COMICK_SOURCE_API = "https://comick-source-api.notaspider.dev";
const MDX_BASE = "https://api.mangadex.org";
const MDX_COVERS = "https://uploads.mangadex.org/covers";
const MDX_QUALITY = "data";

// ─── MangaDex helpers (kept for chapter CDN + metadata enrichment) ───────────

interface MdxManga {
  id: string;
  type: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    description?: Record<string, string>;
    originalLanguage?: string;
    status?: string;
    year?: number;
    publicationDemographic?: string;
    contentRating?: string;
    tags?: Array<{ attributes: { name: Record<string, string>; group: string } }>;
    lastChapter?: string;
    lastVolume?: string;
    availableTranslatedLanguages?: string[];
  };
  relationships: Array<{
    id: string;
    type: string;
    attributes?: Record<string, unknown>;
  }>;
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
      if (Array.isArray(v)) {
        v.forEach((item) => url.searchParams.append(k, String(item)));
      } else {
        url.searchParams.set(k, String(v));
      }
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
  const coverRel = manga.relationships.find((r) => r.type === "cover_art");
  return coverRel?.attributes?.["fileName"] as string | undefined;
}

function getMangaTypeMdx(lang: string): string {
  if (["ko"].includes(lang)) return "Manhwa";
  if (["zh", "zh-hk"].includes(lang)) return "Manhua";
  return "Manga";
}

function getMangaStatus(status: string | null): string {
  if (!status) return "Unknown";
  const map: Record<string, string> = {
    ongoing: "Ongoing",
    completed: "Completed",
    hiatus: "Hiatus",
    cancelled: "Cancelled",
  };
  return map[status.toLowerCase()] ?? status;
}

function normalizeMdxManga(m: MdxManga, coverFileName?: string) {
  const title =
    m.attributes.title["en"] ??
    m.attributes.title["ja-ro"] ??
    Object.values(m.attributes.title)[0] ??
    "Unknown";
  const genres = (m.attributes.tags ?? [])
    .filter((t) => t.attributes.group === "genre" || t.attributes.group === "theme")
    .map((t) => t.attributes.name["en"] ?? Object.values(t.attributes.name)[0])
    .filter(Boolean) as string[];
  const lang = m.attributes.originalLanguage ?? "ja";
  return {
    id: m.id,
    title,
    coverImage: getCoverUrl(m.id, coverFileName),
    provider: "mangadex",
    type: getMangaTypeMdx(lang),
    status: getMangaStatus(m.attributes.status ?? null),
    rating: null as number | null,
    latestChapter: m.attributes.lastChapter ? `Ch. ${m.attributes.lastChapter}` : null,
    genres,
    isNew: false,
    updatedAt: null as string | null,
  };
}

// ─── Comick Source API helpers ───────────────────────────────────────────────

interface ComickSourceItem {
  id?: string;
  slug?: string;
  hid?: string;
  title?: string;
  name?: string;
  cover?: string;
  coverImage?: string;
  image?: string;
  thumbnail?: string;
  url?: string;
  source?: string;
  latestChapter?: string;
  last_chapter?: string;
  genres?: string[];
  status?: string;
  rating?: number | string;
  type?: string;
  views?: number;
  followers?: number;
  updatedAt?: string;
  updated_at?: string;
}

interface ComickChapter {
  id?: string;
  chap?: string;
  number?: string;
  chapter?: string;
  title?: string;
  name?: string;
  date?: string;
  created_at?: string;
  publishAt?: string;
  url?: string;
  images?: string[];
  pages?: string[];
}

interface ComickSearchResponse {
  results?: ComickSourceItem[];
  data?: ComickSourceItem[];
  items?: ComickSourceItem[];
}

interface ComickFrontpageResponse {
  data?: ComickSourceItem[];
  items?: ComickSourceItem[];
  results?: ComickSourceItem[];
  section?: string;
}

interface ComickChaptersResponse {
  chapters?: ComickChapter[];
  data?: ComickChapter[];
  title?: string;
  cover?: string;
  coverImage?: string;
  description?: string;
  status?: string;
  genres?: string[];
  author?: string;
  artist?: string;
  rating?: number | string;
  images?: string[];
  pages?: string[];
}

async function comickPost<T = unknown>(endpoint: string, body: unknown, timeoutMs = 20000): Promise<T> {
  const res = await fetch(`${COMICK_SOURCE_API}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ShiroScans/2.0",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Comick Source API ${endpoint} returned ${res.status}`);
  return res.json() as Promise<T>;
}

async function comickGet<T = unknown>(endpoint: string, timeoutMs = 15000): Promise<T> {
  const res = await fetch(`${COMICK_SOURCE_API}${endpoint}`, {
    headers: { "User-Agent": "ShiroScans/2.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Comick Source API ${endpoint} returned ${res.status}`);
  return res.json() as Promise<T>;
}

function extractId(item: ComickSourceItem, source: string): string {
  const raw = item.id ?? item.slug ?? item.hid ?? item.url ?? "";
  if (raw.startsWith("http")) {
    const parts = raw.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? raw;
  }
  return raw;
}

function extractCover(item: ComickSourceItem): string {
  return item.cover ?? item.coverImage ?? item.image ?? item.thumbnail ?? "";
}

function extractLatestChapter(item: ComickSourceItem): string | null {
  const raw = item.latestChapter ?? item.last_chapter ?? null;
  if (!raw) return null;
  if (raw.startsWith("Ch") || raw.startsWith("ch")) return raw;
  return `Ch. ${raw}`;
}

function extractType(item: ComickSourceItem, source: string): string {
  if (item.type) {
    const t = item.type.toLowerCase();
    if (t.includes("manhwa") || source === "weebcentral") return "Manhwa";
    if (t.includes("manhua")) return "Manhua";
    if (t.includes("webtoon")) return "Webtoon";
  }
  const koreanSources = ["weebcentral"];
  if (koreanSources.includes(source)) return "Manhwa";
  return "Manga";
}

function normalizeComickItem(item: ComickSourceItem, source: string) {
  const id = extractId(item, source);
  const compositeId = `${source}::${id}`;
  return {
    id: compositeId,
    title: item.title ?? item.name ?? "Unknown",
    coverImage: extractCover(item),
    provider: source,
    type: extractType(item, source),
    status: item.status ? getMangaStatus(item.status) : null,
    rating: item.rating ? parseFloat(String(item.rating)) || null : null,
    latestChapter: extractLatestChapter(item),
    genres: Array.isArray(item.genres) ? item.genres : [],
    isNew: false,
    updatedAt: item.updatedAt ?? item.updated_at ?? null,
  };
}

function getSourceFromProvider(provider: string): string {
  const map: Record<string, string> = {
    comick: "comix",
    comix: "comix",
    asura: "asura",
    asurascans: "asura",
    weebcentral: "weebcentral",
    mangago: "mangago",
    mangakatana: "mangakatana",
    mangaread: "mangaread",
    flamescans: "flamescans",
    flamemanga: "flamemanga",
    reaperscans: "reaperscans",
    luminousscans: "luminousscans",
    nightscans: "nightscans",
    drakescans: "drakescans",
  };
  return map[provider.toLowerCase()] ?? provider.toLowerCase();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /manga/sources — list all available sources
router.get("/manga/sources", async (_req, res): Promise<void> => {
  try {
    const data = await comickGet("/api/sources");
    res.json(data);
  } catch {
    res.json([
      { id: "comix", name: "Comick", status: "active", type: "aggregator" },
      { id: "mangadex", name: "MangaDex", status: "active", type: "aggregator" },
      { id: "asura", name: "AsuraScans", status: "active", type: "scanlation" },
      { id: "weebcentral", name: "WeebCentral", status: "active", type: "aggregator" },
      { id: "mangago", name: "Mangago", status: "active", type: "aggregator" },
      { id: "mangakatana", name: "MangaKatana", status: "active", type: "aggregator" },
      { id: "flamescans", name: "FlameScans", status: "active", type: "scanlation" },
    ]);
  }
});

// GET /manga/home — home feed: Comick trending + MangaDex popular as fallback
router.get("/manga/home", async (req, res): Promise<void> => {
  try {
    const [comickTrending, comickLatest, comickNew, mdxLatest, mdxPopular] = await Promise.allSettled([
      comickPost<ComickFrontpageResponse>("/api/frontpage", {
        source: "comix",
        section: "trending",
        page: 1,
        limit: 20,
        days: 7,
      }),
      comickPost<ComickFrontpageResponse>("/api/frontpage", {
        source: "comix",
        section: "latest_hot",
        page: 1,
        limit: 20,
      }),
      comickPost<ComickFrontpageResponse>("/api/frontpage", {
        source: "comix",
        section: "recently_added",
        page: 1,
        limit: 12,
      }),
      mdx<{ data: MdxManga[] }>("/manga", {
        limit: 20,
        "order[latestUploadedChapter]": "desc",
        "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"],
        "availableTranslatedLanguage[]": ["en"],
      }),
      mdx<{ data: MdxManga[] }>("/manga", {
        limit: 20,
        "order[followedCount]": "desc",
        "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"],
        "availableTranslatedLanguage[]": ["en"],
      }),
    ]);

    const extractComickItems = (result: PromiseSettledResult<ComickFrontpageResponse>, source: string) => {
      if (result.status !== "fulfilled") return [];
      const raw = result.value.data ?? result.value.items ?? result.value.results ?? [];
      return raw.map((item) => normalizeComickItem(item, source));
    };

    const trendingItems = extractComickItems(comickTrending, "comix");
    const latestItems = extractComickItems(comickLatest, "comix");
    const newItems = extractComickItems(comickNew, "comix");

    const mdxLatestItems =
      mdxLatest.status === "fulfilled"
        ? mdxLatest.value.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)))
        : [];

    const mdxPopularItems =
      mdxPopular.status === "fulfilled"
        ? mdxPopular.value.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)))
        : [];

    const featured = trendingItems.length >= 6 ? trendingItems.slice(0, 6) : mdxPopularItems.slice(0, 6);
    const latestUpdates = latestItems.length > 0 ? latestItems : mdxLatestItems;
    const popularNow = trendingItems.length > 0 ? trendingItems : mdxPopularItems;
    const newSeries = newItems.length > 0 ? newItems : [];

    res.json({ featured, latestUpdates, popularNow, newSeries });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch home feed");
    res.json({ featured: [], latestUpdates: [], popularNow: [], newSeries: [] });
  }
});

// POST /manga/frontpage — expose frontpage sections from Comick Source API
router.post("/manga/frontpage", async (req, res): Promise<void> => {
  const { source = "comix", section = "trending", page = 1, limit = 30, days } = req.body as {
    source?: string;
    section?: string;
    page?: number;
    limit?: number;
    days?: number;
  };

  try {
    const body: Record<string, unknown> = { source, section, page, limit };
    if (days !== undefined) body.days = days;

    const data = await comickPost<ComickFrontpageResponse>("/api/frontpage", body);
    const raw = data.data ?? data.items ?? data.results ?? [];
    const items = raw.map((item) => normalizeComickItem(item, source));
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
        limit: 20,
        offset,
        "order[latestUploadedChapter]": "desc",
        "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"],
        "availableTranslatedLanguage[]": ["en"],
      };
      if (status && ["ongoing", "completed", "hiatus", "cancelled"].includes(status)) {
        params["status[]"] = [status];
      }
      const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", params);
      const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
      res.json({ items, page, hasMore: offset + items.length < data.total });
    } catch (err) {
      req.log.error({ err }, "Failed to fetch MangaDex latest");
      res.json({ items: [], page, hasMore: false });
    }
    return;
  }

  const source = getSourceFromProvider(provider);
  try {
    const data = await comickPost<ComickFrontpageResponse>("/api/frontpage", {
      source,
      section: "latest_hot",
      page,
      limit: 24,
    });
    const raw = data.data ?? data.items ?? data.results ?? [];
    const items = raw.map((item) => normalizeComickItem(item, source));
    const filtered = items.filter((item) => {
      if (status && item.status && item.status.toLowerCase() !== status.toLowerCase()) return false;
      if (type && item.type && item.type.toLowerCase() !== type.toLowerCase()) return false;
      return true;
    });
    res.json({ items: filtered, page, hasMore: raw.length >= 24 });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch latest from Comick Source API");
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
        limit: 20,
        offset,
        "order[followedCount]": "desc",
        "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"],
        "availableTranslatedLanguage[]": ["en"],
      };
      if (status && ["ongoing", "completed", "hiatus", "cancelled"].includes(status)) {
        params["status[]"] = [status];
      }
      const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", params);
      const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
      res.json({ items, page, hasMore: offset + items.length < data.total });
    } catch (err) {
      req.log.error({ err }, "Failed to fetch MangaDex popular");
      res.json({ items: [], page, hasMore: false });
    }
    return;
  }

  const source = getSourceFromProvider(provider);
  try {
    const data = await comickPost<ComickFrontpageResponse>("/api/frontpage", {
      source,
      section: "trending",
      page,
      limit: 24,
      days: 30,
    });
    const raw = data.data ?? data.items ?? data.results ?? [];
    const items = raw.map((item) => normalizeComickItem(item, source));
    const filtered = items.filter((item) => {
      if (status && item.status && item.status.toLowerCase() !== status.toLowerCase()) return false;
      if (type && item.type && item.type.toLowerCase() !== type.toLowerCase()) return false;
      return true;
    });
    res.json({ items: filtered, page, hasMore: raw.length >= 24 });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch popular from Comick Source API");
    res.json({ items: [], page, hasMore: false });
  }
});

// GET /manga/search
router.get("/manga/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const provider = req.query.provider ? String(req.query.provider) : "all";
  const offset = (page - 1) * 20;

  if (!q) {
    res.json({ items: [], page: 1, hasMore: false });
    return;
  }

  if (provider === "mangadex") {
    try {
      const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", {
        title: q,
        limit: 20,
        offset,
        "includes[]": ["cover_art"],
        "contentRating[]": ["safe", "suggestive"],
      });
      const items = data.data.map((m) => normalizeMdxManga(m, extractCoverFileName(m)));
      res.json({ items, page, hasMore: offset + items.length < data.total });
    } catch (err) {
      req.log.error({ err }, "Failed to search MangaDex");
      res.json({ items: [], page: 1, hasMore: false });
    }
    return;
  }

  const source = provider === "all" ? "all" : getSourceFromProvider(provider);

  try {
    const [comickResult, mdxResult] = await Promise.allSettled([
      comickPost<ComickSearchResponse>("/api/search", { query: q, source }),
      provider === "all"
        ? mdx<{ data: MdxManga[] }>("/manga", {
            title: q,
            limit: 10,
            offset: 0,
            "includes[]": ["cover_art"],
            "contentRating[]": ["safe", "suggestive"],
          })
        : Promise.reject(new Error("skip")),
    ]);

    const comickItems: ReturnType<typeof normalizeComickItem>[] = [];
    if (comickResult.status === "fulfilled") {
      const raw = comickResult.value.results ?? comickResult.value.data ?? comickResult.value.items ?? [];
      for (const item of raw) {
        const itemSource = item.source ?? source;
        comickItems.push(normalizeComickItem(item, itemSource === "all" ? "comix" : itemSource));
      }
    }

    const mdxItems: ReturnType<typeof normalizeMdxManga>[] = [];
    if (provider === "all" && mdxResult.status === "fulfilled" && "data" in mdxResult.value) {
      const mdxData = mdxResult.value as { data: MdxManga[] };
      for (const m of mdxData.data) {
        mdxItems.push(normalizeMdxManga(m, extractCoverFileName(m)));
      }
    }

    const seen = new Set<string>();
    const deduped: Array<ReturnType<typeof normalizeComickItem> | ReturnType<typeof normalizeMdxManga>> = [];
    for (const item of [...comickItems, ...mdxItems]) {
      const key = item.title.toLowerCase().replace(/\s+/g, "");
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }

    res.json({ items: deduped, page: 1, hasMore: false });
  } catch (err) {
    req.log.error({ err }, "Failed to search");
    res.json({ items: [], page: 1, hasMore: false });
  }
});

// GET /manga/series/:provider/:id
router.get("/manga/series/:provider/:id", async (req, res): Promise<void> => {
  const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const safeProvider = decodeURIComponent(rawProvider ?? "mangadex");
  const safeId = decodeURIComponent(rawId ?? "");

  if (safeProvider === "mangadex") {
    try {
      const [mangaRes, feedRes] = await Promise.allSettled([
        mdx<{ data: MdxManga }>(`/manga/${safeId}`, {
          "includes[]": ["cover_art", "author", "artist"],
        }),
        mdx<{ data: MdxChapter[]; total: number }>(`/manga/${safeId}/feed`, {
          limit: 500,
          "translatedLanguage[]": ["en"],
          "order[chapter]": "desc",
          "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
        }),
      ]);

      if (mangaRes.status === "rejected") {
        res.status(404).json({ error: "Series not found" });
        return;
      }

      const m = mangaRes.value.data;
      const base = normalizeMdxManga(m, extractCoverFileName(m));
      const altTitles: string[] = [];
      (m.attributes.altTitles ?? []).forEach((t) => {
        const val = t["en"] ?? t["ja-ro"] ?? Object.values(t)[0];
        if (val && !altTitles.includes(val)) altTitles.push(val);
      });

      const authorRel = m.relationships.find((r) => r.type === "author");
      const authorName = authorRel?.attributes?.["name"] as string | undefined;

      const chaptersRaw: MdxChapter[] = feedRes.status === "fulfilled" ? feedRes.value.data : [];
      const seenChapters = new Set<string>();
      const chapters = chaptersRaw
        .filter((c) => {
          const num = c.attributes.chapter ?? "0";
          if (seenChapters.has(num)) return false;
          seenChapters.add(num);
          return true;
        })
        .map((c) => ({
          id: c.id,
          number: c.attributes.chapter ?? "0",
          title: c.attributes.title ?? null,
          releasedAt: c.attributes.publishAt ?? null,
          views: null as null,
        }));

      const description =
        m.attributes.description?.["en"] ?? Object.values(m.attributes.description ?? {})[0] ?? null;

      res.json({
        id: m.id,
        title: base.title,
        coverImage: base.coverImage,
        bannerImage: null,
        provider: "mangadex",
        type: base.type,
        status: base.status,
        rating: base.rating,
        description,
        genres: base.genres,
        author: authorName ?? null,
        artist: null,
        chapters,
        totalChapters: chapters.length,
        alternativeTitles: altTitles.slice(0, 5),
        serialization: null,
        updatedAt: null,
      });
    } catch (err) {
      req.log.error({ err, id: safeId }, "Failed to fetch MangaDex series");
      res.status(404).json({ error: "Series not found" });
    }
    return;
  }

  // Non-MangaDex: use Comick Source API chapters endpoint (returns metadata + chapter list)
  const source = getSourceFromProvider(safeProvider);
  const actualId = safeId.includes("::") ? safeId.split("::").slice(1).join("::") : safeId;

  try {
    const data = await comickPost<ComickChaptersResponse>("/api/chapters", {
      id: actualId,
      source,
      url: actualId.startsWith("http") ? actualId : undefined,
    });

    const chaptersRaw: ComickChapter[] = data.chapters ?? data.data ?? [];
    const seenChapters = new Set<string>();
    const chapters = chaptersRaw
      .filter((c) => {
        const num = c.chap ?? c.number ?? c.chapter ?? "0";
        if (seenChapters.has(num)) return false;
        seenChapters.add(num);
        return true;
      })
      .map((c) => ({
        id: c.id ?? c.url ?? `${source}-${c.chap ?? c.number ?? "0"}`,
        number: c.chap ?? c.number ?? c.chapter ?? "0",
        title: c.title ?? c.name ?? null,
        releasedAt: c.date ?? c.created_at ?? c.publishAt ?? null,
        views: null as null,
      }))
      .sort((a, b) => parseFloat(b.number) - parseFloat(a.number));

    res.json({
      id: safeId,
      title: data.title ?? actualId,
      coverImage: data.cover ?? data.coverImage ?? "",
      bannerImage: null,
      provider: source,
      type: "Manga",
      status: data.status ? getMangaStatus(data.status) : null,
      rating: data.rating ? parseFloat(String(data.rating)) || null : null,
      description: data.description ?? null,
      genres: Array.isArray(data.genres) ? data.genres : [],
      author: data.author ?? null,
      artist: data.artist ?? null,
      chapters,
      totalChapters: chapters.length,
      alternativeTitles: [],
      serialization: null,
      updatedAt: null,
    });
  } catch (err) {
    req.log.error({ err, id: safeId, source }, "Failed to fetch series from Comick Source API");
    res.status(404).json({ error: "Series not found" });
  }
});

// GET /manga/chapters/:provider/:seriesId/:chapterId
router.get("/manga/chapters/:provider/:seriesId/:chapterId", async (req, res): Promise<void> => {
  const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const rawSeriesId = Array.isArray(req.params.seriesId) ? req.params.seriesId[0] : req.params.seriesId;
  const rawChapterId = Array.isArray(req.params.chapterId) ? req.params.chapterId[0] : req.params.chapterId;
  const safeProvider = decodeURIComponent(rawProvider ?? "mangadex");
  const safeSeriesId = decodeURIComponent(rawSeriesId ?? "");
  const safeChapterId = decodeURIComponent(rawChapterId ?? "");

  if (safeProvider === "mangadex") {
    try {
      const [serverRes, chapterRes] = await Promise.all([
        mdx<{
          baseUrl: string;
          chapter: { hash: string; data: string[]; dataSaver: string[] };
        }>(`/at-home/server/${safeChapterId}`),
        mdx<{ data: MdxChapter }>(`/chapter/${safeChapterId}`),
      ]);

      const { baseUrl, chapter } = serverRes;
      const pages = chapter[MDX_QUALITY].map(
        (file) => `${baseUrl}/${MDX_QUALITY}/${chapter.hash}/${file}`,
      );

      const chapterData = chapterRes.data;
      const currentChapter = chapterData.attributes.chapter ?? safeChapterId;

      const feedRes = await mdx<{ data: MdxChapter[] }>(`/manga/${safeSeriesId}/feed`, {
        limit: 500,
        "translatedLanguage[]": ["en"],
        "order[chapter]": "desc",
        "contentRating[]": ["safe", "suggestive", "erotica", "pornographic"],
      });

      const allChapters = feedRes.data;
      const idx = allChapters.findIndex((c) => c.id === safeChapterId);
      const prevChapterId = idx >= 0 && idx < allChapters.length - 1 ? allChapters[idx + 1].id : null;
      const nextChapterId = idx > 0 ? allChapters[idx - 1].id : null;

      const mangaRes = await mdx<{ data: MdxManga }>(`/manga/${safeSeriesId}`, {
        "includes[]": ["cover_art"],
      });
      const seriesTitle =
        mangaRes.data.attributes.title["en"] ??
        Object.values(mangaRes.data.attributes.title)[0] ??
        "";

      res.json({
        seriesId: safeSeriesId,
        chapterId: safeChapterId,
        provider: "mangadex",
        pages,
        currentChapter,
        prevChapterId,
        nextChapterId,
        seriesTitle,
        chapterTitle: chapterData.attributes.title ?? null,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to fetch MangaDex chapter pages");
      res.status(404).json({ error: "Chapter not found" });
    }
    return;
  }

  // Non-MangaDex: fetch chapter via Comick Source API
  const source = getSourceFromProvider(safeProvider);
  const actualSeriesId = safeSeriesId.includes("::") ? safeSeriesId.split("::").slice(1).join("::") : safeSeriesId;
  const actualChapterId = safeChapterId.includes("::") ? safeChapterId.split("::").slice(1).join("::") : safeChapterId;

  try {
    const data = await comickPost<ComickChaptersResponse>("/api/chapters", {
      id: actualSeriesId,
      source,
      chapterId: actualChapterId,
      url: actualChapterId.startsWith("http") ? actualChapterId : undefined,
    });

    const pages: string[] = data.images ?? data.pages ?? [];

    const chaptersRaw: ComickChapter[] = data.chapters ?? data.data ?? [];
    const idx = chaptersRaw.findIndex((c) => (c.id ?? c.url) === actualChapterId);
    const prevChapterId = idx < chaptersRaw.length - 1 && idx >= 0
      ? `${source}::${chaptersRaw[idx + 1].id ?? chaptersRaw[idx + 1].url}`
      : null;
    const nextChapterId = idx > 0
      ? `${source}::${chaptersRaw[idx - 1].id ?? chaptersRaw[idx - 1].url}`
      : null;

    const currentChapter =
      chaptersRaw[idx]?.chap ?? chaptersRaw[idx]?.number ?? chaptersRaw[idx]?.chapter ?? actualChapterId;

    res.json({
      seriesId: safeSeriesId,
      chapterId: safeChapterId,
      provider: source,
      pages,
      currentChapter: String(currentChapter),
      prevChapterId,
      nextChapterId,
      seriesTitle: data.title ?? "",
      chapterTitle: chaptersRaw[idx]?.title ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch chapter pages from Comick Source API");
    res.status(404).json({ error: "Chapter not found" });
  }
});

// GET /manga/random
router.get("/manga/random", async (req, res): Promise<void> => {
  const provider = req.query.provider ? String(req.query.provider) : "mangadex";
  if (provider !== "mangadex") {
    try {
      const data = await comickPost<ComickFrontpageResponse>("/api/frontpage", {
        source: getSourceFromProvider(provider),
        section: "trending",
        page: 1,
        limit: 30,
        days: 7,
      });
      const raw = data.data ?? data.items ?? data.results ?? [];
      if (raw.length > 0) {
        const item = raw[Math.floor(Math.random() * raw.length)];
        res.json(normalizeComickItem(item, getSourceFromProvider(provider)));
        return;
      }
    } catch {
      // fall through to MangaDex
    }
  }
  try {
    const data = await mdx<{ data: MdxManga }>("/manga/random", {
      "includes[]": ["cover_art"],
      "contentRating[]": ["safe", "suggestive"],
    });
    res.json(normalizeMdxManga(data.data, extractCoverFileName(data.data)));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch random manga");
    res.status(500).json({ error: "Failed to fetch random manga" });
  }
});

// GET /manga/tags — genres from MangaDex + common genre list
router.get("/manga/tags", async (_req, res): Promise<void> => {
  try {
    const data = await mdx<{
      data: Array<{ id: string; attributes: { name: Record<string, string>; group: string } }>;
    }>("/manga/tag");
    const tags = data.data
      .filter((t) => t.attributes.group === "genre")
      .map((t) => ({
        id: t.id,
        name: t.attributes.name["en"] ?? Object.values(t.attributes.name)[0],
      }));
    res.json(tags);
  } catch {
    const fallback = [
      "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery",
      "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
      "Isekai", "Martial Arts", "Mecha", "School Life", "Psychological", "Historical",
      "Harem", "Reverse Harem", "Villainess", "System", "Cultivation", "Tower",
    ];
    res.json(fallback.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, "-"), name })));
  }
});

export default router;
