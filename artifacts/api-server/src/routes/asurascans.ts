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
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`AsuraScans ${path} returned ${res.status}`);
  return res.text();
}

// Astro serializes props as HTML-encoded JSON with [type, value] tuples.
// type 0 = scalar/object, type 1 = array of [type, value] tuples
function deserializeAstro(val: unknown): unknown {
  if (!Array.isArray(val)) {
    if (val !== null && typeof val === "object") {
      return Object.fromEntries(
        Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, deserializeAstro(v)])
      );
    }
    return val;
  }
  const [type, data] = val as [number, unknown];
  if (type === 0) return deserializeAstro(data);
  if (type === 1) return (data as unknown[]).map(deserializeAstro);
  return data;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Extract all Astro island props from HTML and return as parsed objects
function extractAstroIslands(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const re = /<astro-island[^>]+props="(\{[^"]{10,}\})"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const raw = decodeHtmlEntities(m[1]);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const deserialized = deserializeAstro(parsed) as Record<string, unknown>;
      results.push(deserialized);
    } catch {
      // skip malformed islands
    }
  }
  return results;
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

// Parse Schema.org JSON-LD from inline <script type="application/ld+json"> tags
function extractJsonLd(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const re = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]) as Record<string, unknown>;
      results.push(data);
    } catch {
      // skip malformed JSON-LD
    }
  }
  return results;
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

function parseSeriesPage(html: string, slug: string): AsuraSeries | null {
  // 1. Try Schema.org JSON-LD ComicSeries
  const jsonLds = extractJsonLd(html);
  const comicLd = jsonLds.find((d) => d["@type"] === "ComicSeries") as Record<string, unknown> | undefined;

  let title = "";
  let description = "";
  let coverUrl = "";
  let genres: string[] = [];
  let status = "Ongoing";

  if (comicLd) {
    title = cleanText(comicLd.name ?? comicLd.headline ?? "");
    description = cleanText(comicLd.description ?? "");
    coverUrl = String(
      (comicLd.image as Record<string, unknown> | undefined)?.url ??
      comicLd.image ??
      ""
    );
    genres = asArray<string>(comicLd.genre as unknown[]).map(cleanText).filter(Boolean);
  }

  if (!title) {
    // Fallback: og:title
    const ogM = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogM) title = cleanText(ogM[1].replace(/\s*\|\s*Asura\s*Scans?$/i, ""));
  }
  if (!coverUrl) {
    const ogImgM = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImgM) coverUrl = ogImgM[1];
  }
  if (!description) {
    const descM = html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    if (descM) description = cleanText(descM[1]);
  }

  if (!title) return null;

  // 2. Extract chapter list from HTML links: /comics/slug-hash/chapter/N
  const chapterLinksRe = new RegExp(`href=["']/comics/${slug}/chapter/(\\d+)[/"']`, "gi");
  const seenNums = new Set<number>();
  const chapters: AsuraChapter[] = [];
  let cm: RegExpExecArray | null;
  while ((cm = chapterLinksRe.exec(html)) !== null) {
    const num = parseInt(cm[1], 10);
    if (!isNaN(num) && !seenNums.has(num)) {
      seenNums.add(num);
      chapters.push({
        id: String(num),
        slug: `chapter-${num}`,
        number: num,
        title: "",
        releaseDate: null,
      });
    }
  }
  // Sort descending (latest first)
  chapters.sort((a, b) => b.number - a.number);

  // 3. Extract status from inline HTML
  const statusM = html.match(/Status\s*<[^>]+>\s*<[^>]+>([^<]+)/i)
    || html.match(/class=["'][^"']*status[^"']*["'][^>]*>([^<]{2,30})/i);
  if (statusM) status = normalizeStatus(statusM[1]);

  // 4. Author/Artist from HTML
  const authorM = html.match(/Author[^<]*<[^>]*>([^<]+)/i);
  const author = authorM ? cleanText(authorM[1]) : "";
  const artistM = html.match(/Artist[^<]*<[^>]*>([^<]+)/i);
  const artist = artistM ? cleanText(artistM[1]) : "";

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
    altTitles: [],
    totalChapters: chapters.length,
    chapters,
  };
}

function extractChapterImages(html: string, slug: string): {
  pages: string[];
  chapterList: AsuraChapter[];
  prevChapterId: string | null;
  nextChapterId: string | null;
  seriesName: string;
  chapterNumber: number;
} {
  const islands = extractAstroIslands(html);

  // Find the island that has chapter pages (has "pages" and "seriesSlug")
  const chapterIsland = islands.find((isl) => isl.pages && isl.seriesSlug) as Record<string, unknown> | undefined;

  let pages: string[] = [];
  let chapterList: AsuraChapter[] = [];
  let prevChapterId: string | null = null;
  let nextChapterId: string | null = null;
  let seriesName = "";
  let chapterNumber = 0;

  if (chapterIsland) {
    seriesName = cleanText(chapterIsland.seriesName ?? "");
    chapterNumber = Number(chapterIsland.chapterNumber ?? 0);

    // Extract pages
    const rawPages = asArray<Record<string, unknown>>(chapterIsland.pages as unknown[]);
    pages = rawPages.map((p) => String(p.url ?? "")).filter((u) => u.startsWith("http"));

    // Extract chapter list
    const rawChapterList = asArray<Record<string, unknown>>(chapterIsland.chapterList as unknown[]);
    for (const ch of rawChapterList) {
      const num = Number(ch.number ?? 0);
      if (num > 0) {
        chapterList.push({
          id: String(num),
          slug: String(ch.slug ?? `chapter-${num}`),
          number: num,
          title: cleanText(ch.title ?? ""),
          releaseDate: String(ch.created_at ?? "") || null,
        });
      }
    }
    // Sort descending
    chapterList.sort((a, b) => b.number - a.number);

    // Extract prev/next
    const prevCh = chapterIsland.prevChapter as Record<string, unknown> | null | undefined;
    const nextCh = chapterIsland.nextChapter as Record<string, unknown> | null | undefined;
    if (prevCh && typeof prevCh === "object" && prevCh.number) {
      prevChapterId = String(prevCh.number);
    }
    if (nextCh && typeof nextCh === "object" && nextCh.number) {
      nextChapterId = String(nextCh.number);
    }
  }

  // Fallback: extract images directly from src attributes
  if (pages.length === 0) {
    const chaptersPathBase = `/asura-images/chapters/${slug.replace(/-[0-9a-f]{6,}$/, "")}/`;
    const allImgRe = /src=["'](https:\/\/cdn\.asurascans\.com\/asura-images\/chapters\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)['"]/gi;
    let im: RegExpExecArray | null;
    while ((im = allImgRe.exec(html)) !== null) {
      const url = im[1];
      if (url.includes(chaptersPathBase) || pages.length > 0) pages.push(url);
    }
    // If still empty, grab all chapter images
    if (pages.length === 0) {
      const anyRe = /src=["'](https:\/\/cdn\.asurascans\.com\/asura-images\/chapters\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)['"]/gi;
      let am: RegExpExecArray | null;
      while ((am = anyRe.exec(html)) !== null) pages.push(am[1]);
    }
  }

  return { pages, chapterList, prevChapterId, nextChapterId, seriesName, chapterNumber };
}

async function fetchHomeData(): Promise<{ featured: AsuraPreview[]; popular: AsuraPreview[]; latest: AsuraPreview[] }> {
  const html = await asuraFetch("/");
  const islands = extractAstroIslands(html);

  let featured: AsuraPreview[] = [];
  let popular: AsuraPreview[] = [];
  let latest: AsuraPreview[] = [];

  // Astro islands on the home page contain "items" arrays with hero carousel series
  // The hrefs in the HTML use /comics/slug-hashid format
  // We extract slugs from the HTML hrefs (which include the hash suffix), and use those
  // alongside cover URLs and titles from the Astro island data

  // Get hrefs order from HTML (includes hash: got-dropped-into-...-19cdf401)
  const hrefRe = /href=["']\/comics\/([a-z0-9-]+-[0-9a-f]{6,8})[/"']/gi;
  const hrefOrder: string[] = [];
  const seenHrefs = new Set<string>();
  let hm: RegExpExecArray | null;
  while ((hm = hrefRe.exec(html)) !== null) {
    if (!seenHrefs.has(hm[1])) {
      seenHrefs.add(hm[1]);
      hrefOrder.push(hm[1]); // full slug with hash, e.g. "got-dropped-into-...-19cdf401"
    }
  }

  // Map slug-without-hash → full-slug-with-hash
  // e.g. "got-dropped-into-a-ghost-story-still-gotta-work" → "got-dropped-into-a-ghost-story-still-gotta-work-19cdf401"
  const slugToFullSlug = new Map<string, string>();
  for (const fullSlug of hrefOrder) {
    const withoutHash = fullSlug.replace(/-[0-9a-f]{6,8}$/, "");
    slugToFullSlug.set(withoutHash, fullSlug);
  }

  // Find the island(s) with series "items"
  for (const island of islands) {
    if (!island.items) continue;
    const items = asArray<Record<string, unknown>>(island.items as unknown[]);
    if (items.length === 0) continue;

    // Check if first item has slug and title (series data)
    const first = items[0] as Record<string, unknown>;
    if (!first.slug || !first.title) continue;

    const previews: AsuraPreview[] = items.map((item: Record<string, unknown>): AsuraPreview => {
      const bareSlug = String(item.slug ?? "");
      const fullSlug = slugToFullSlug.get(bareSlug) ?? bareSlug;
      return {
        id: fullSlug,
        sourceId: "asurascans",
        title: cleanText(item.title ?? ""),
        coverUrl: String(item.cover_url ?? item.cover ?? item.coverUrl ?? ""),
        status: normalizeStatus(item.status ?? "Ongoing"),
        latestChapter: item.last_chapter ? Number(item.last_chapter) : undefined,
        genres: asArray<unknown>(item.genres as unknown[]).map((g) => cleanText(
          typeof g === "object" && g !== null ? (g as Record<string, unknown>).name ?? g : g
        )).filter(Boolean),
      };
    }).filter((p: AsuraPreview) => p.id && p.title);

    if (featured.length === 0) {
      featured = previews.slice(0, 10);
    } else if (popular.length === 0) {
      popular = previews.slice(0, 20);
    } else if (latest.length === 0) {
      latest = previews.slice(0, 20);
    }
  }

  // Fallback: use the hrefs + og:image from HTML if islands gave nothing
  if (featured.length === 0 && hrefOrder.length > 0) {
    // Extract titles from HTML around each href
    const previewsFromHtml: AsuraPreview[] = [];
    for (const fullSlug of hrefOrder.slice(0, 20)) {
      // Try to find title near the href
      const escapedSlug = fullSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const blockRe = new RegExp(`href=["']/comics/${escapedSlug}[/"'][^>]*>[\\s\\S]{0,600}?(?=href=["']|$)`, "i");
      const blockM = html.match(blockRe);
      let title = "";
      if (blockM) {
        const tm = blockM[0].match(/>([A-Z][^<]{2,80})</);
        if (tm) title = cleanText(tm[1]);
      }
      if (!title) continue;

      // Cover: look for cdn.asurascans.com cover matching the slug without hash
      const bareSlug = fullSlug.replace(/-[0-9a-f]{6,8}$/, "");
      const coverRe = new RegExp(`(https://cdn\\.asurascans\\.com/asura-images/covers/${bareSlug}\\.[^"']+)`, "i");
      const coverM = html.match(coverRe);
      const coverUrl = coverM ? coverM[1] : "";

      previewsFromHtml.push({ id: fullSlug, sourceId: "asurascans", title, coverUrl, status: "Ongoing", genres: [] });
    }
    featured = previewsFromHtml.slice(0, 10);
    popular = previewsFromHtml.slice(0, 20);
    latest = previewsFromHtml.slice(0, 20);
  }

  if (featured.length === 0) featured = popular.slice(0, 8);

  return { featured, popular, latest };
}

// GET /api/asurascans/home
router.get("/asurascans/home", async (_req, res): Promise<void> => {
  try {
    const data = await withAsuraCache("asura:home", 15 * 60 * 1000, fetchHomeData);
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
    const data = await withAsuraCache(`asura:series:${slug}`, 30 * 60 * 1000, async (): Promise<AsuraSeries> => {
      const html = await asuraFetch(`/comics/${slug}/`);
      const series = parseSeriesPage(html, slug);
      if (!series || !series.title) throw new Error(`Could not parse series data for ${slug}`);
      return series;
    });
    res.json(data);
  } catch (err) {
    console.error(`[AsuraScans] series ${slug} error:`, err);
    res.status(502).json({ error: "Failed to fetch series" });
  }
});

// GET /api/asurascans/chapters/:slug/:chapterNum
// chapterNum is the numeric chapter number (e.g. "1", "22")
router.get("/asurascans/chapters/:slug/:chapterNum", async (req, res): Promise<void> => {
  const { slug, chapterNum } = req.params;
  if (!slug || !chapterNum) { res.status(400).json({ error: "slug and chapterNum required" }); return; }

  const cacheKey = `asura:chapter:${slug}:${chapterNum}`;

  try {
    const result = await withAsuraCache(cacheKey, 6 * 60 * 60 * 1000, async () => {
      const html = await asuraFetch(`/comics/${slug}/chapter/${chapterNum}`);
      const { pages, chapterList, prevChapterId, nextChapterId, seriesName, chapterNumber } =
        extractChapterImages(html, slug);

      return {
        id: chapterNum,
        seriesId: slug,
        seriesTitle: seriesName,
        pages,
        currentChapter: String(chapterNumber || chapterNum),
        prevChapterId,
        nextChapterId,
        chapterList,
        embedUrl: `https://asurascans.com/comics/${slug}/chapter/${chapterNum}`,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(`[AsuraScans] chapter ${slug}/${chapterNum} error:`, err);
    res.status(502).json({ error: "Failed to fetch chapter pages" });
  }
});

// GET /api/asurascans/search?q=
router.get("/asurascans/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (!q) { res.json({ results: [] }); return; }

  try {
    const results = await withAsuraCache(`asura:search:${q.toLowerCase()}`, 5 * 60 * 1000, async (): Promise<AsuraPreview[]> => {
      // asurascans uses /browse with a search parameter
      const searchPaths = [
        `/browse?search=${encodeURIComponent(q)}`,
        `/browse?q=${encodeURIComponent(q)}`,
      ];

      // Always load home data in parallel for cover enrichment
      const homeDataPromise = fetchHomeData().catch(() => null);

      for (const p of searchPaths) {
        try {
          const html = await asuraFetch(p);
          const items = extractBrowseItems(html);
          const lower = q.toLowerCase();
          let candidates = items.filter((i) => i.title.toLowerCase().includes(lower));
          if (candidates.length === 0 && items.length > 0) candidates = items.slice(0, 20);
          if (candidates.length > 0) {
            // Enrich missing cover URLs from home data
            const homeData = await homeDataPromise;
            if (homeData) {
              const homeMap = new Map([...homeData.featured, ...homeData.popular, ...homeData.latest].map((i) => [i.id, i]));
              return candidates.map((item) => item.coverUrl ? item : { ...item, coverUrl: homeMap.get(item.id)?.coverUrl ?? "" });
            }
            return candidates;
          }
        } catch { continue; }
      }

      // If browse doesn't work, use home data as fallback
      const homeData = await homeDataPromise ?? await fetchHomeData();
      const lower = q.toLowerCase();
      const allItems = [...homeData.featured, ...homeData.popular, ...homeData.latest];
      const seen = new Set<string>();
      return allItems.filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return i.title.toLowerCase().includes(lower);
      });
    });

    res.json({ results });
  } catch (err) {
    console.error("[AsuraScans] search error:", err);
    res.status(502).json({ error: "Search failed", results: [] });
  }
});

function extractBrowseItems(html: string): AsuraPreview[] {
  const items: AsuraPreview[] = [];
  const seen = new Set<string>();

  // Build a map from bare-slug → full-slug (with hash) using HTML hrefs
  // e.g. "nano-machine" → "nano-machine-19cdf401"
  const fullSlugMap = new Map<string, string>();
  const hrefHashRe = /href=["']\/comics\/([a-z0-9]+-(?:[a-z0-9]+-)*[0-9a-f]{6,8})[/"']/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hrefHashRe.exec(html)) !== null) {
    const fullSlug = hm[1];
    const bareSlug = fullSlug.replace(/-[0-9a-f]{6,8}$/, "");
    if (!fullSlugMap.has(bareSlug)) fullSlugMap.set(bareSlug, fullSlug);
  }

  // Extract from Astro islands — supports both "items" (home/popular) and "initialSeries" (browse/search)
  const islands = extractAstroIslands(html);
  for (const island of islands) {
    const rawItems = asArray<Record<string, unknown>>(
      (island.items ?? island.initialSeries ?? []) as unknown[]
    );
    if (rawItems.length === 0) continue;
    for (const item of rawItems) {
      if (!item.slug || !item.title) continue;
      const bareSlug = String(item.slug);
      // Prefer full hash-suffixed slug from HTML hrefs; fall back to bare slug
      const slug = fullSlugMap.get(bareSlug) ?? bareSlug;
      if (seen.has(slug)) continue;
      seen.add(slug);
      items.push({
        id: slug,
        sourceId: "asurascans",
        title: cleanText(item.title ?? ""),
        coverUrl: String(item.cover_url ?? item.cover ?? item.image ?? item.thumbnail ?? item.cover_image ?? item.coverImage ?? item.poster ?? ""),
        status: normalizeStatus(item.status ?? "Ongoing"),
        latestChapter: item.last_chapter ? Number(item.last_chapter) : undefined,
        genres: asArray<unknown>(item.genres as unknown[]).map((g) => cleanText(
          typeof g === "object" && g !== null ? (g as Record<string, unknown>).name ?? g : g
        )).filter(Boolean),
      });
    }
  }

  // Fallback: extract from href patterns
  if (items.length === 0) {
    const hrefRe = /href=["']\/comics\/([a-z0-9-]+-[0-9a-f]{6,8})[/"']/gi;
    let hm: RegExpExecArray | null;
    while ((hm = hrefRe.exec(html)) !== null) {
      const fullSlug = hm[1];
      if (seen.has(fullSlug)) continue;
      seen.add(fullSlug);
      items.push({
        id: fullSlug,
        sourceId: "asurascans",
        title: fullSlug.replace(/-[0-9a-f]{6,8}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        coverUrl: "",
        status: "Ongoing",
        genres: [],
      });
    }
  }

  return items;
}

// GET /api/asurascans/browse?genre=&status=&page=
router.get("/asurascans/browse", async (req, res): Promise<void> => {
  const genre = req.query.genre ? String(req.query.genre).toLowerCase() : "";
  const status = req.query.status ? String(req.query.status).toLowerCase() : "";
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));

  const cacheKey = `asura:browse:${genre}:${status}:${page}`;

  try {
    const data = await withAsuraCache(cacheKey, 10 * 60 * 1000, async () => {
      const params = new URLSearchParams();
      if (genre) params.set("genres", genre);
      if (status) params.set("status", status);
      if (page > 1) params.set("page", String(page));

      const html = await asuraFetch(`/browse?${params.toString()}`);
      const items = extractBrowseItems(html);

      return { results: items, page, hasMore: items.length >= 20, total: items.length };
    });

    res.json(data);
  } catch (err) {
    console.error("[AsuraScans] browse error:", err);
    res.status(502).json({ error: "Browse failed", results: [], page: 1, hasMore: false });
  }
});

// GET /api/asurascans/latest?page=1
router.get("/asurascans/latest", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  try {
    if (page === 1) {
      const homeData = await withAsuraCache("asura:home", 15 * 60 * 1000, fetchHomeData);
      res.json({ items: homeData.latest, hasMore: true, page: 1 });
    } else {
      const cacheKey = `asura:browse:latest:${page}`;
      const data = await withAsuraCache(cacheKey, 10 * 60 * 1000, async () => {
        const params = new URLSearchParams();
        if (page > 1) params.set("page", String(page));
        const html = await asuraFetch(`/browse?${params.toString()}`);
        const items = extractBrowseItems(html);
        return { items, hasMore: items.length >= 20, page };
      });
      res.json(data);
    }
  } catch (err) {
    console.error("[AsuraScans] latest error:", err);
    res.status(502).json({ error: "Failed to fetch latest", items: [], hasMore: false });
  }
});

// GET /api/asurascans/popular?page=1
router.get("/asurascans/popular", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  try {
    if (page === 1) {
      const homeData = await withAsuraCache("asura:home", 15 * 60 * 1000, fetchHomeData);
      res.json({ items: homeData.popular, hasMore: false, page: 1 });
    } else {
      const cacheKey = `asura:browse:popular:${page}`;
      const data = await withAsuraCache(cacheKey, 10 * 60 * 1000, async () => {
        const params = new URLSearchParams();
        if (page > 1) params.set("page", String(page));
        const html = await asuraFetch(`/browse?${params.toString()}`);
        const items = extractBrowseItems(html);
        return { items, hasMore: items.length >= 20, page };
      });
      res.json(data);
    }
  } catch (err) {
    console.error("[AsuraScans] popular error:", err);
    res.status(502).json({ error: "Failed to fetch popular", items: [], hasMore: false });
  }
});

// Background pre-warm: populate home cache on startup so first visitor is fast
setImmediate(() => {
  withAsuraCache("asura:home", 15 * 60 * 1000, fetchHomeData).catch(() => {});
});

export default router;
