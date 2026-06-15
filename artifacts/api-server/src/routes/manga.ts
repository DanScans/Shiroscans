import { Router, type IRouter } from "express";

const router: IRouter = Router();

const MDX_BASE = "https://api.mangadex.org";
const MDX_COVERS = "https://uploads.mangadex.org/covers";

const QUALITY = "data";

async function mdx<T = Record<string, unknown>>(
  path: string,
  params?: Record<string, string | string[] | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${MDX_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        // key already contains "[]" suffix — append directly without adding more brackets
        v.forEach((item) => url.searchParams.append(k, String(item)));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "ShiroScans/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`MangaDex ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

function getCoverUrl(mangaId: string, fileName: string | undefined): string {
  if (!fileName) return "";
  return `${MDX_COVERS}/${mangaId}/${fileName}.512.jpg`;
}

function getMangaType(
  demographic: string | null,
  lang: string,
): string {
  if (lang !== "ja") {
    if (["ko"].includes(lang)) return "Manhwa";
    if (["zh", "zh-hk"].includes(lang)) return "Manhua";
    return "Manga";
  }
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

function normalizeManga(m: MdxManga, coverFileName?: string) {
  const title =
    m.attributes.title["en"] ??
    m.attributes.title["ja-ro"] ??
    Object.values(m.attributes.title)[0] ??
    "Unknown";

  const genres = (m.attributes.tags ?? [])
    .filter((t) => t.attributes.group === "genre" || t.attributes.group === "theme")
    .map((t) => t.attributes.name["en"] ?? Object.values(t.attributes.name)[0])
    .filter(Boolean);

  const lang = m.attributes.originalLanguage ?? "ja";
  const type = getMangaType(m.attributes.publicationDemographic ?? null, lang);

  return {
    id: m.id,
    title,
    coverImage: getCoverUrl(m.id, coverFileName),
    provider: "mangadex",
    type,
    status: getMangaStatus(m.attributes.status ?? null),
    rating: null as number | null,
    latestChapter: m.attributes.lastChapter ? `Ch. ${m.attributes.lastChapter}` : null,
    genres: genres as string[],
    isNew: false,
    updatedAt: null as string | null,
  };
}

function extractCoverFileName(manga: MdxManga): string | undefined {
  const coverRel = manga.relationships.find((r) => r.type === "cover_art");
  return coverRel?.attributes?.["fileName"] as string | undefined;
}

router.get("/manga/home", async (req, res): Promise<void> => {
  try {
    const [latestRes, popularRes] = await Promise.allSettled([
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

    const latest =
      latestRes.status === "fulfilled"
        ? latestRes.value.data.map((m) => normalizeManga(m, extractCoverFileName(m)))
        : [];
    const popular =
      popularRes.status === "fulfilled"
        ? popularRes.value.data.map((m) => normalizeManga(m, extractCoverFileName(m)))
        : [];

    res.json({
      featured: popular.slice(0, 6),
      latestUpdates: latest,
      popularNow: popular,
      newSeries: [] as ReturnType<typeof normalizeManga>[],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch home feed");
    res.json({ featured: [], latestUpdates: [], popularNow: [], newSeries: [] });
  }
});

router.get("/manga/latest", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const type = req.query.type ? String(req.query.type) : undefined;
  const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
  const genre = req.query.genre ? String(req.query.genre) : undefined;

  const offset = (page - 1) * 20;

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
    const items = data.data.map((m) => normalizeManga(m, extractCoverFileName(m)));

    res.json({ items, page, hasMore: offset + items.length < data.total });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch latest manga");
    res.json({ items: [], page, hasMore: false });
  }
});

router.get("/manga/popular", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
  const offset = (page - 1) * 20;

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
    const items = data.data.map((m) => normalizeManga(m, extractCoverFileName(m)));

    res.json({ items, page, hasMore: offset + items.length < data.total });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch popular manga");
    res.json({ items: [], page, hasMore: false });
  }
});

router.get("/manga/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const offset = (page - 1) * 20;

  if (!q) {
    res.json({ items: [], page: 1, hasMore: false });
    return;
  }

  try {
    const data = await mdx<{ data: MdxManga[]; total: number }>("/manga", {
      title: q,
      limit: 20,
      offset,
      "includes[]": ["cover_art"],
      "contentRating[]": ["safe", "suggestive"],
    });

    const items = data.data.map((m) => normalizeManga(m, extractCoverFileName(m)));
    res.json({ items, page, hasMore: offset + items.length < data.total });
  } catch (err) {
    req.log.error({ err }, "Failed to search manga");
    res.json({ items: [], page: 1, hasMore: false });
  }
});

router.get("/manga/series/:provider/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const safeId = decodeURIComponent(rawId ?? "");

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
    const base = normalizeManga(m, extractCoverFileName(m));

    const altTitles: string[] = [];
    (m.attributes.altTitles ?? []).forEach((t) => {
      const val = t["en"] ?? t["ja-ro"] ?? Object.values(t)[0];
      if (val && !altTitles.includes(val)) altTitles.push(val);
    });

    const authorRel = m.relationships.find((r) => r.type === "author");
    const authorName = authorRel?.attributes?.["name"] as string | undefined;

    const chaptersRaw: MdxChapter[] =
      feedRes.status === "fulfilled" ? feedRes.value.data : [];

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
    req.log.error({ err, id: safeId }, "Failed to fetch series");
    res.status(404).json({ error: "Series not found" });
  }
});

router.get("/manga/chapters/:provider/:seriesId/:chapterId", async (req, res): Promise<void> => {
  const rawSeriesId = Array.isArray(req.params.seriesId) ? req.params.seriesId[0] : req.params.seriesId;
  const rawChapterId = Array.isArray(req.params.chapterId) ? req.params.chapterId[0] : req.params.chapterId;
  const safeSeriesId = decodeURIComponent(rawSeriesId ?? "");
  const safeChapterId = decodeURIComponent(rawChapterId ?? "");

  try {
    const [serverRes, chapterRes] = await Promise.all([
      mdx<{
        baseUrl: string;
        chapter: { hash: string; data: string[]; dataSaver: string[] };
      }>(`/at-home/server/${safeChapterId}`),
      mdx<{ data: MdxChapter }>(`/chapter/${safeChapterId}`),
    ]);

    const { baseUrl, chapter } = serverRes;
    const pages = chapter[QUALITY].map(
      (file) => `${baseUrl}/${QUALITY}/${chapter.hash}/${file}`,
    );

    const chapterData = chapterRes.data;
    const currentChapter = chapterData.attributes.chapter ?? safeChapterId;

    const feedRes = await mdx<{ data: MdxChapter[]; total: number }>(`/manga/${safeSeriesId}/feed`, {
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
    req.log.error({ err }, "Failed to fetch chapter pages");
    res.status(404).json({ error: "Chapter not found" });
  }
});

router.get("/manga/random", async (req, res): Promise<void> => {
  try {
    const data = await mdx<{ data: MdxManga }>("/manga/random", {
      "includes[]": ["cover_art"],
      "contentRating[]": ["safe", "suggestive"],
    });
    const m = data.data;
    res.json(normalizeManga(m, extractCoverFileName(m)));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch random manga");
    res.status(500).json({ error: "Failed to fetch random manga" });
  }
});

router.get("/manga/tags", async (_req, res): Promise<void> => {
  try {
    const data = await mdx<{ data: Array<{ id: string; attributes: { name: Record<string, string>; group: string } }> }>("/manga/tag");
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
    ];
    res.json(fallback.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, "-"), name })));
  }
});

export default router;
