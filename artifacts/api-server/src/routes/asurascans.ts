import { Router, type IRouter } from "express";

const router: IRouter = Router();

const _asuraCache = new Map<string, { data: unknown; expiresAt: number }>();
function withAsuraCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _asuraCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    _asuraCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

const ASURA_DOMAIN = "https://asurascans.com";

const ASURA_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Referer": `${ASURA_DOMAIN}/`,
  "Origin": ASURA_DOMAIN,
};

async function asuraFetch(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${ASURA_DOMAIN}${path}`;
  const res = await fetch(url, {
    headers: ASURA_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`AsuraScans ${path} returned ${res.status}`);
  return res.text();
}

async function asuraJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${ASURA_DOMAIN}${path}`;
  const res = await fetch(url, {
    headers: { ...ASURA_HEADERS, "Accept": "application/json, */*" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`AsuraScans JSON ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

function extractNextData(html: string): Record<string, any> | null {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1]) as Record<string, any>;
  } catch {
    return null;
  }
}

function cleanText(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–").replace(/&#8212;/g, "—").replace(/&#038;/g, "&")
    .replace(/\s+/g, " ").trim();
}

function normalizeStatus(s: unknown): string {
  const v = cleanText(s).toLowerCase();
  if (v.includes("ongoing") || v.includes("releasing")) return "Ongoing";
  if (v.includes("complet") || v.includes("finished")) return "Completed";
  if (v.includes("hiatus") || v.includes("on hold")) return "Hiatus";
  if (v.includes("drop") || v.includes("cancel")) return "Dropped";
  if (v.includes("season end")) return "Completed";
  return cleanText(s) || "Ongoing";
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function extractCoverFromHtml(html: string, slug: string): string {
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/,
    new RegExp(`${slug}[^"']*\\.(jpg|jpeg|png|webp)`),
    /class=["'][^"']*thumb[^"']*["'][^>]*src=["']([^"']+)["']/,
    /<img[^>]+class=["'][^"']*wp-post-image[^"']*["'][^>]*src=["']([^"']+)["']/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1] && m[1].startsWith("http")) return m[1].split("?")[0];
  }
  return "";
}

function extractSeriesFromHtml(html: string): Array<{ id: string; title: string; coverUrl: string; status: string; latestChapter?: number; genres: string[] }> {
  const items: Array<{ id: string; title: string; coverUrl: string; status: string; latestChapter?: number; genres: string[] }> = [];

  const itemPattern = /<(?:div|article|li)[^>]+class=["'][^"']*(?:page-item-detail|bs|bsx|manga-item|series-item|comics-item)[^"']*["'][^>]*>([\s\S]*?)(?=<(?:div|article|li)[^>]+class=["'][^"']*(?:page-item-detail|bs|bsx|manga-item|series-item|comics-item)|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html)) !== null && items.length < 50) {
    const block = match[1];

    const hrefM = block.match(/href=["']([^"']*\/(?:series|manga|comics|manhua|manhwa)\/([^/"']+))[/"']/i);
    if (!hrefM) continue;
    const slug = hrefM[2];
    const id = slug;

    const titleM = block.match(/<(?:h\d|span)[^>]+class=["'][^"']*(?:title|ntitle|series-title)[^"']*["'][^>]*>([^<]+)/i)
      || block.match(/class=["'][^"']*(?:title|ntitle)[^"']*["'][^>]*>([^<]+)/i)
      || block.match(/<(?:span|h\d)[^>]*>([^<]{2,80})<\/(?:span|h\d)>/i);
    if (!titleM) continue;
    const title = cleanText(titleM[1]);
    if (!title || title.length < 2) continue;

    const imgM = block.match(/src=["']([^"']+(?:\.jpg|\.jpeg|\.png|\.webp))[^"']*["']/i)
      || block.match(/data-src=["']([^"']+(?:\.jpg|\.jpeg|\.png|\.webp))[^"']*["']/i);
    const coverUrl = imgM ? imgM[1].split("?")[0] : "";

    const statusM = block.match(/class=["'][^"']*status[^"']*["'][^>]*>([^<]+)/i);
    const status = statusM ? normalizeStatus(statusM[1]) : "Ongoing";

    const chM = block.match(/Chapter\s+([\d.]+)/i);
    const latestChapter = chM ? parseFloat(chM[1]) : undefined;

    items.push({ id, title, coverUrl, status, latestChapter, genres: [] });
  }

  return items;
}

interface AsuraSeries {
  id: string;
  sourceId: string;
  title: string;
  coverUrl: string;
  description: string;
  author: string;
  artist: string;
  status: string;
  genres: string[];
  altTitles: string[];
  totalChapters: number;
  chapters: AsuraChapter[];
}

interface AsuraChapter {
  id: string;
  slug: string;
  number: number;
  title: string;
  releaseDate: string | null;
}

interface AsuraPreview {
  id: string;
  sourceId: string;
  title: string;
  coverUrl: string;
  status: string;
  latestChapter?: number;
  genres: string[];
}

function parseSeriesPageNextData(nd: Record<string, any>): AsuraSeries | null {
  const pp = nd?.props?.pageProps;
  if (!pp) return null;

  const comic = pp.comic ?? pp.series ?? pp.manga ?? pp.post ?? pp.data;
  if (!comic) return null;

  const slug = String(comic.slug ?? comic.series_slug ?? nd.query?.series ?? "");
  const title = cleanText(comic.title ?? comic.name ?? comic.comic_title ?? "");
  if (!title) return null;

  const coverUrl = String(comic.cover ?? comic.coverUrl ?? comic.image ?? comic.thumbnail ?? comic.cover_image ?? pp.meta?.image ?? "");
  const description = cleanText(comic.description ?? comic.synopsis ?? comic.summary ?? comic.overview ?? "");
  const author = cleanText(
    (Array.isArray(comic.authors) ? comic.authors.map((a: any) => a?.name ?? a).join(", ") : comic.author) ?? ""
  );
  const artist = cleanText(
    (Array.isArray(comic.artists) ? comic.artists.map((a: any) => a?.name ?? a).join(", ") : comic.artist) ?? ""
  );
  const status = normalizeStatus(comic.status ?? comic.comic_status ?? "Ongoing");
  const genres = asArray<any>(comic.genres ?? comic.tags ?? comic.categories)
    .map((g: any) => cleanText(g?.name ?? g?.title ?? g))
    .filter((g: string) => g.length > 0);
  const altTitles = asArray<any>(comic.altTitles ?? comic.alt_titles ?? comic.other_names ?? comic.aliases)
    .map((t: any) => cleanText(t?.name ?? t))
    .filter((t: string) => t.length > 0);

  const rawChapters = asArray<any>(comic.chapters ?? pp.chapters ?? comic.chapter_list ?? []);
  const chapters: AsuraChapter[] = rawChapters.map((ch: any) => {
    const chNum = parseFloat(String(ch.chapter ?? ch.chapter_number ?? ch.chapter_num ?? ch.number ?? 0));
    const chSlug = String(ch.slug ?? ch.chapter_slug ?? ch.id ?? ch.chapter_id ?? chNum);
    return {
      id: chSlug,
      slug: chSlug,
      number: chNum,
      title: cleanText(ch.title ?? ch.chapter_title ?? ""),
      releaseDate: ch.created_at ?? ch.release_date ?? ch.date ?? ch.updated_at ?? null,
    };
  }).filter((ch: AsuraChapter) => ch.number > 0 || ch.slug);

  return {
    id: slug,
    sourceId: "asurascans",
    title,
    coverUrl: coverUrl.startsWith("http") ? coverUrl : (coverUrl ? `${ASURA_DOMAIN}${coverUrl}` : ""),
    description,
    author,
    artist,
    status,
    genres,
    altTitles,
    totalChapters: chapters.length,
    chapters,
  };
}

function parseSeriesPageHtml(html: string, slug: string): AsuraSeries | null {
  const nd = extractNextData(html);
  if (nd) {
    const result = parseSeriesPageNextData(nd);
    if (result) return result;
  }

  const titleM = html.match(/<h1[^>]*class=["'][^"']*(?:title|entry-title|series-title)[^"']*["'][^>]*>([^<]+)/i)
    || html.match(/<h1[^>]*>([^<]{2,120})<\/h1>/i)
    || html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (!titleM) return null;
  const title = cleanText(titleM[1]);

  const coverUrl = extractCoverFromHtml(html, slug);

  const descM = html.match(/class=["'][^"']*(?:description|summary|synopsis|overview)[^"']*["'][^>]*>([\s\S]{10,2000}?)(?=<\/(?:div|p|section))/i)
    || html.match(/property=["']og:description["'][^>]*content=["']([^"']{10,}?)["']/i);
  const description = descM ? cleanText(descM[1]) : "";

  const authorM = html.match(/(?:Author|Artist)[^<]*<[^>]*>([^<]+)/i);
  const author = authorM ? cleanText(authorM[1]) : "";

  const statusM = html.match(/Status[^<]*<[^>]*>([^<]+)/i)
    || html.match(/class=["'][^"']*status[^"']*["'][^>]*>([^<]+)/i);
  const status = statusM ? normalizeStatus(statusM[1]) : "Ongoing";

  const genreMatches = [...html.matchAll(/href=["'][^"']*(?:genre|tag|category)\/([^/"']+)[/"'][^>]*>([^<]+)/gi)];
  const genres = genreMatches.map((m) => cleanText(m[2])).filter(Boolean).slice(0, 15);

  const chapterPattern = /href=["']([^"']*(?:chapter|ch)[^"']*\/([^/"']+))[/"'][^>]*>[\s\S]*?Chapter\s+([\d.]+)/gi;
  const chapters: AsuraChapter[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = chapterPattern.exec(html)) !== null && chapters.length < 500) {
    const chSlug = cm[2];
    const chNum = parseFloat(cm[3]);
    if (!isNaN(chNum)) {
      chapters.push({ id: chSlug, slug: chSlug, number: chNum, title: "", releaseDate: null });
    }
  }

  return {
    id: slug,
    sourceId: "asurascans",
    title,
    coverUrl,
    description,
    author,
    artist: "",
    status,
    genres,
    altTitles: [],
    totalChapters: chapters.length,
    chapters,
  };
}

function extractChapterImages(html: string): string[] {
  const nd = extractNextData(html);
  if (nd) {
    const pp = nd?.props?.pageProps;
    const images: string[] = [];

    const imgSources = [
      pp?.chapter?.chapter_image,
      pp?.chapter?.images,
      pp?.chapter?.pages,
      pp?.pages,
      pp?.images,
      pp?.chapter_images,
      pp?.chapterImages,
    ];

    for (const src of imgSources) {
      if (!src) continue;
      if (Array.isArray(src)) {
        for (const item of src) {
          const url = typeof item === "string" ? item : (item?.url ?? item?.src ?? item?.image ?? item?.image_url ?? "");
          if (url && url.startsWith("http")) images.push(url);
        }
        if (images.length > 0) return images;
      } else if (typeof src === "object") {
        for (const val of Object.values(src)) {
          const url = typeof val === "string" ? val : (val as any)?.url ?? "";
          if (url && url.startsWith("http")) images.push(url);
        }
        if (images.length > 0) return images.sort();
      }
    }
  }

  const images: string[] = [];

  const readerPatterns = [
    /<div[^>]+class=["'][^"']*(?:reading-content|reader-area|chapter-content|content-image|manga-content|page-img)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]+id=["'](?:image-list|chapter-images|reader)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const pattern of readerPatterns) {
    const sectionMatch = pattern.exec(html);
    if (sectionMatch) {
      const section = sectionMatch[1];
      const imgMatches = [...section.matchAll(/(?:src|data-src|data-lazy-src)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)['"]/gi)];
      for (const m of imgMatches) {
        if (m[1].startsWith("http") && !m[1].includes("logo") && !m[1].includes("icon")) {
          images.push(m[1]);
        }
      }
      if (images.length > 0) return images;
    }
  }

  const allImgMatches = [...html.matchAll(/(?:src|data-src|data-lazy-src)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)['"]/gi)];
  for (const m of allImgMatches) {
    const url = m[1];
    if (!url.startsWith("http")) continue;
    if (url.includes("logo") || url.includes("icon") || url.includes("banner") || url.includes("avatar")) continue;
    if (url.includes("cover") && images.length > 0) continue;
    images.push(url);
  }

  return images;
}

async function fetchHomeData(): Promise<{ featured: AsuraPreview[]; popular: AsuraPreview[]; latest: AsuraPreview[] }> {
  const html = await asuraFetch("/");
  const nd = extractNextData(html);

  let featured: AsuraPreview[] = [];
  let popular: AsuraPreview[] = [];
  let latest: AsuraPreview[] = [];

  if (nd) {
    const pp = nd?.props?.pageProps ?? {};

    const carouselSrc = asArray<any>(pp.carousel ?? pp.featured ?? pp.slider ?? pp.highlight ?? pp.topSeries ?? pp.hot);
    if (carouselSrc.length > 0) {
      featured = carouselSrc.slice(0, 10).map((c: any): AsuraPreview => ({
        id: String(c.slug ?? c.series_slug ?? c.id ?? c.comic_slug ?? ""),
        sourceId: "asurascans",
        title: cleanText(c.title ?? c.name ?? c.comic_title ?? ""),
        coverUrl: String(c.cover ?? c.image ?? c.coverUrl ?? c.thumbnail ?? ""),
        status: normalizeStatus(c.status ?? "Ongoing"),
        latestChapter: c.last_chapter ?? c.latestChapter ?? c.chapter_count ?? undefined,
        genres: asArray<any>(c.genres ?? c.tags ?? []).map((g: any) => cleanText(g?.name ?? g)),
      })).filter((c: AsuraPreview) => c.id && c.title);
    }

    const popularSrc = asArray<any>(pp.popular ?? pp.popularSeries ?? pp.trending ?? pp.hot ?? pp.popularComics);
    if (popularSrc.length > 0) {
      popular = popularSrc.slice(0, 20).map((c: any): AsuraPreview => ({
        id: String(c.slug ?? c.series_slug ?? c.id ?? ""),
        sourceId: "asurascans",
        title: cleanText(c.title ?? c.name ?? ""),
        coverUrl: String(c.cover ?? c.image ?? c.coverUrl ?? ""),
        status: normalizeStatus(c.status ?? "Ongoing"),
        latestChapter: c.last_chapter ?? c.latestChapter ?? undefined,
        genres: asArray<any>(c.genres ?? c.tags ?? []).map((g: any) => cleanText(g?.name ?? g)),
      })).filter((c: AsuraPreview) => c.id && c.title);
    }

    const latestSrc = asArray<any>(pp.latest ?? pp.latestSeries ?? pp.recentlyUpdated ?? pp.comics ?? pp.series);
    if (latestSrc.length > 0) {
      latest = latestSrc.slice(0, 20).map((c: any): AsuraPreview => ({
        id: String(c.slug ?? c.series_slug ?? c.id ?? ""),
        sourceId: "asurascans",
        title: cleanText(c.title ?? c.name ?? ""),
        coverUrl: String(c.cover ?? c.image ?? c.coverUrl ?? ""),
        status: normalizeStatus(c.status ?? "Ongoing"),
        latestChapter: c.last_chapter ?? c.latestChapter ?? undefined,
        genres: asArray<any>(c.genres ?? c.tags ?? []).map((g: any) => cleanText(g?.name ?? g)),
      })).filter((c: AsuraPreview) => c.id && c.title);
    }
  }

  if (featured.length === 0 && popular.length === 0) {
    const items = extractSeriesFromHtml(html);
    featured = items.slice(0, 8).map((i) => ({ ...i, sourceId: "asurascans" }));
    popular = items.slice(0, 20).map((i) => ({ ...i, sourceId: "asurascans" }));
    latest = items.slice(0, 20).map((i) => ({ ...i, sourceId: "asurascans" }));
  }

  if (featured.length === 0) featured = popular.slice(0, 8);

  return { featured, popular, latest };
}

// GET /api/asurascans/home
router.get("/asurascans/home", async (_req, res): Promise<void> => {
  try {
    const data = await withAsuraCache("asura:home", 5 * 60 * 1000, fetchHomeData);
    res.json(data);
  } catch (err) {
    console.error("[AsuraScans] home error:", err);
    res.status(502).json({ error: "Failed to fetch AsuraScans home", featured: [], popular: [], latest: [] });
  }
});

// GET /api/asurascans/series/:slug
router.get("/asurascans/series/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug;
  if (!slug) { res.status(400).json({ error: "slug required" }); return; }

  try {
    const data = await withAsuraCache(`asura:series:${slug}`, 10 * 60 * 1000, async (): Promise<AsuraSeries> => {
      const paths = [
        `/series/${slug}/`,
        `/comics/${slug}/`,
        `/manga/${slug}/`,
        `/${slug}/`,
      ];

      let html = "";
      let fetchedPath = "";
      for (const p of paths) {
        try {
          html = await asuraFetch(p);
          fetchedPath = p;
          break;
        } catch {
          continue;
        }
      }

      if (!html) throw new Error(`Series ${slug} not found on any path`);

      const series = parseSeriesPageHtml(html, slug);
      if (!series || !series.title) throw new Error(`Could not parse series data for ${slug}`);
      return series;
    });

    res.json(data);
  } catch (err) {
    console.error(`[AsuraScans] series ${slug} error:`, err);
    res.status(502).json({ error: "Failed to fetch series" });
  }
});

// GET /api/asurascans/chapters/:slug/:chapterId
router.get("/asurascans/chapters/:slug/:chapterId", async (req, res): Promise<void> => {
  const { slug, chapterId } = req.params;
  if (!slug || !chapterId) { res.status(400).json({ error: "slug and chapterId required" }); return; }

  const cacheKey = `asura:chapter:${slug}:${chapterId}`;
  const cached = _asuraCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.data);
    return;
  }

  try {
    const seriesData = await withAsuraCache(`asura:series:${slug}`, 10 * 60 * 1000, async (): Promise<AsuraSeries> => {
      const paths = [`/series/${slug}/`, `/comics/${slug}/`, `/manga/${slug}/`, `/${slug}/`];
      for (const p of paths) {
        try {
          const html = await asuraFetch(p);
          const series = parseSeriesPageHtml(html, slug);
          if (series?.title) return series;
        } catch { continue; }
      }
      throw new Error(`Series ${slug} not found`);
    });

    const allChapters = seriesData.chapters;
    const sortedChapters = [...allChapters].sort((a, b) => a.number - b.number);
    const currentIdx = sortedChapters.findIndex((c) => c.id === chapterId || c.slug === chapterId);

    const prevChapter = currentIdx > 0 ? sortedChapters[currentIdx - 1] : null;
    const nextChapter = currentIdx >= 0 && currentIdx < sortedChapters.length - 1 ? sortedChapters[currentIdx + 1] : null;
    const currentNum = currentIdx >= 0 ? String(sortedChapters[currentIdx].number) : chapterId;

    const chapterPaths = [
      `/series/${slug}/${chapterId}/`,
      `/series/${slug}/chapter-${chapterId}/`,
      `/comics/${slug}/${chapterId}/`,
      `/comics/${slug}/chapter-${chapterId}/`,
      `/${slug}/${chapterId}/`,
      `/${slug}/chapter-${chapterId}/`,
    ];

    let pages: string[] = [];
    for (const p of chapterPaths) {
      try {
        const html = await asuraFetch(p);
        pages = extractChapterImages(html);
        if (pages.length > 0) break;
      } catch { continue; }
    }

    const response = {
      id: chapterId,
      seriesId: slug,
      seriesTitle: seriesData.title,
      pages,
      currentChapter: currentNum,
      prevChapterId: prevChapter?.id ?? null,
      nextChapterId: nextChapter?.id ?? null,
    };

    _asuraCache.set(cacheKey, { data: response, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
    res.json(response);
  } catch (err) {
    console.error(`[AsuraScans] chapter ${slug}/${chapterId} error:`, err);
    res.status(502).json({ error: "Failed to fetch chapter pages" });
  }
});

// GET /api/asurascans/search?q=
router.get("/asurascans/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q) { res.json({ results: [] }); return; }

  try {
    const results = await withAsuraCache(`asura:search:${q.toLowerCase()}`, 2 * 60 * 1000, async (): Promise<AsuraPreview[]> => {
      const paths = [
        `/series/?search=${encodeURIComponent(q)}`,
        `/?s=${encodeURIComponent(q)}&post_type=wp-manga`,
        `/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=20&_fields=slug,title,featured_media`,
        `/series/?search_value=${encodeURIComponent(q)}`,
      ];

      for (const p of paths) {
        try {
          if (p.includes("wp-json")) {
            type WpPost = { slug: string; title: { rendered: string }; featured_media?: string; link?: string };
            const data = await asuraJson<WpPost[]>(p);
            if (Array.isArray(data) && data.length > 0) {
              return data.map((post: WpPost) => ({
                id: post.slug,
                sourceId: "asurascans",
                title: cleanText(post.title?.rendered ?? post.slug),
                coverUrl: "",
                status: "Ongoing",
                genres: [],
              }));
            }
          } else {
            const html = await asuraFetch(p);
            const items = extractSeriesFromHtml(html);
            const lower = q.toLowerCase();
            const filtered = items.filter((i) => i.title.toLowerCase().includes(lower));
            if (filtered.length > 0) return filtered.map((i) => ({ ...i, sourceId: "asurascans" }));
            if (items.length > 0) return items.map((i) => ({ ...i, sourceId: "asurascans" })).slice(0, 20);
          }
        } catch { continue; }
      }

      return [];
    });

    res.json({ results });
  } catch (err) {
    console.error("[AsuraScans] search error:", err);
    res.status(502).json({ error: "Search failed", results: [] });
  }
});

// GET /api/asurascans/browse?genre=&status=&page=
router.get("/asurascans/browse", async (req, res): Promise<void> => {
  const genre = req.query.genre ? String(req.query.genre).toLowerCase() : "";
  const status = req.query.status ? String(req.query.status).toLowerCase() : "";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 24;

  const cacheKey = `asura:browse:${genre}:${status}:${page}`;

  try {
    const data = await withAsuraCache(cacheKey, 5 * 60 * 1000, async () => {
      const params = new URLSearchParams();
      if (genre) params.set("genre", genre);
      if (status) params.set("status", status);
      if (page > 1) params.set("page", String(page));

      const paths = [
        `/series/?${params.toString()}`,
        `/comics/?${params.toString()}`,
        `/series/page/${page}/?${params.toString()}`,
      ];

      let items: AsuraPreview[] = [];
      for (const p of paths) {
        try {
          const html = await asuraFetch(p);
          const raw = extractSeriesFromHtml(html);
          if (raw.length > 0) {
            items = raw.map((i) => ({ ...i, sourceId: "asurascans" }));
            break;
          }
        } catch { continue; }
      }

      if (items.length === 0) {
        const { popular } = await fetchHomeData();
        items = popular;
      }

      if (genre) items = items.filter((i) => i.genres.some((g) => g.toLowerCase() === genre));
      if (status) items = items.filter((i) => normalizeStatus(i.status).toLowerCase().includes(status));

      const total = items.length;
      const paged = items.slice((page - 1) * limit, page * limit);
      return { results: paged, total, page, hasMore: page * limit < total || items.length >= limit };
    });

    res.json(data);
  } catch (err) {
    console.error("[AsuraScans] browse error:", err);
    res.status(502).json({ error: "Browse failed", results: [], total: 0, page, hasMore: false });
  }
});

export default router;
