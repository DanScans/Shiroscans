import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";

const router: IRouter = Router();

const WC_BASE = "https://weebcentral.com";
const CDN_COVER = "https://temp.compsci88.com/cover/small";
const CDN_FALLBACK = "https://temp.compsci88.com/cover/fallback";

const WC_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": `${WC_BASE}/`,
  "HX-Request": "true",
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

const TTL_HOME    = 10 * 60 * 1000;
const TTL_BROWSE  = 5  * 60 * 1000;
const TTL_SERIES  = 20 * 60 * 1000;
const TTL_CHAPTER = 12 * 60 * 1000;
const TTL_IMAGES  = 10 * 60 * 1000;

// Reconstruct cover URL from ULID (CDN-based, always works)
function coverFromId(id: string): string {
  return `${CDN_COVER}/${id}.webp`;
}

// Convert URL slug to human-readable title
function slugToTitle(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Strip "cover" suffix from alt text
function altToTitle(alt: string): string {
  return alt.replace(/\s+cover\s*$/i, "").trim();
}

async function wcFetch(path: string, extraHeaders: Record<string, string> = {}, method = "GET", body?: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${WC_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { ...WC_HEADERS, ...extraHeaders, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: body ?? undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`WeebCentral ${url} → ${res.status}`);
  return res.text();
}

interface WCSeries {
  id: string;
  title: string;
  coverUrl: string;
  type: string;
  status: string;
  genres: string[];
  latestChapter: string | null;
  description?: string;
  authors?: string[];
}

// Parse WeebCentral home page HTML — series come from href="/series/ULID/Slug" with preload
function parseHomepageSeries(html: string): { featured: WCSeries[]; popular: WCSeries[]; latest: WCSeries[] } {
  const featured: WCSeries[] = [];
  const latest: WCSeries[] = [];
  const seen = new Set<string>();

  // Two patterns found in homepage:
  // 1. Regular featured links: href="https://weebcentral.com/series/ULID/..." preload
  // 2. Latest updates: <a class="aspect-square ..."> href="..." preload>

  const seriesRe = /href=["']https:\/\/weebcentral\.com\/series\/([A-Z0-9]+)\/([^"']+?)["']/g;
  let m: RegExpExecArray | null;

  // Go through all series links and classify them
  // We'll look at surrounding context to determine which section they belong to
  const latestMarker = /aspect-square/;
  const lines = html.split("\n");

  for (const line of lines) {
    const seriesMatch = /href=["']https:\/\/weebcentral\.com\/series\/([A-Z0-9]+)\/([^"']+?)["']/.exec(line);
    if (!seriesMatch) continue;
    const [, id, slug] = seriesMatch;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    // Get title: try img alt attribute first, then fall back to slug
    const altMatch = /alt=["']([^"']+cover)["']/.exec(line);
    const title = altMatch ? altToTitle(altMatch[1]) : slugToTitle(slug);
    if (!title) continue;

    const item: WCSeries = {
      id,
      title,
      coverUrl: coverFromId(id),
      type: "Manga",
      status: "Ongoing",
      genres: [],
      latestChapter: null,
    };

    if (latestMarker.test(line)) {
      latest.push(item);
    } else if (line.includes("preload")) {
      featured.push(item);
    }
  }

  // Also use the regex across the full HTML to catch any missed series
  seriesRe.lastIndex = 0;
  while ((m = seriesRe.exec(html)) !== null) {
    const id = m[1];
    const slug = m[2];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    featured.push({
      id,
      title: slugToTitle(slug),
      coverUrl: coverFromId(id),
      type: "Manga",
      status: "Ongoing",
      genres: [],
      latestChapter: null,
    });
  }

  return {
    featured: featured.slice(0, 24),
    popular: featured.slice(0, 48),
    latest: latest.length > 0 ? latest : featured.slice(0, 48),
  };
}

// Parse WeebCentral simple search POST results
// Format: <a href="https://weebcentral.com/series/ULID/slug" class="btn join-item h-20">
//           <picture><source srcset="...ULID.webp"><img ... alt="Title cover"></picture>
//           <div>Title</div></a>
function parseSimpleSearchResults(html: string): WCSeries[] {
  const $ = cheerio.load(html);
  const results: WCSeries[] = [];
  const seen = new Set<string>();

  $("a[href*='/series/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const idMatch = href.match(/\/series\/([A-Z0-9]+)/i);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seen.has(id)) return;
    seen.add(id);

    const alt = $(el).find("img").attr("alt") ?? "";
    const title = alt ? altToTitle(alt) : $(el).find("div").last().text().trim();
    if (!title || title.length < 2) return;

    const srcset = $(el).find("source").attr("srcset") ?? "";
    const imgSrc = $(el).find("img").attr("src") ?? "";
    const coverUrl = srcset || imgSrc || coverFromId(id);

    results.push({
      id,
      title,
      coverUrl: coverUrl.startsWith("http") ? coverUrl : coverFromId(id),
      type: "Manga",
      status: "Ongoing",
      genres: [],
      latestChapter: null,
    });
  });

  return results;
}

async function fetchHomePage(): Promise<{ featured: WCSeries[]; popular: WCSeries[]; latest: WCSeries[] }> {
  const html = await wcFetch("/", { "HX-Current-URL": WC_BASE });
  return parseHomepageSeries(html);
}

interface WCChapter {
  id: string;
  number: number;
  title: string;
  releaseDate: string | null;
}

function parseChapterList(html: string): WCChapter[] {
  const $ = cheerio.load(html);
  const chapters: WCChapter[] = [];
  const seen = new Set<string>();

  $("a[href*='/chapters/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const chId = href.match(/\/chapters\/([A-Z0-9]+)/i)?.[1];
    if (!chId || seen.has(chId)) return;
    seen.add(chId);

    // Clone, remove svg/badges, then get only first span/div text
    const $el = $(el).clone();
    $el.find("svg, [class*='badge'], [class*='read'], [x-show], [x-if]").remove();

    // Get text from first meaningful child that contains chapter info
    let text = "";
    $el.children().each((_, child) => {
      const childText = $(child).text().trim();
      if (childText && childText.length > 0 && !childText.includes("T00:00") && !childText.includes("Last Read")) {
        if (!text) text = childText;
      }
    });
    if (!text) text = $el.text().split("\n")[0]?.trim() ?? "";

    // Strip date-like strings and "Last Read" noise
    text = text
      .replace(/Last Read/gi, "")
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.Z]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const numM = text.match(/(?:episode|chapter|ch)[\s.]*(\d+(?:\.\d+)?)/i) ?? text.match(/(\d+(?:\.\d+)?)/);
    const num = numM ? parseFloat(numM[1]) : 0;

    const xData = $(el).closest("[x-data]").attr("x-data") ?? "";
    const dateM = xData.match(/checkNewChapter\('([^']+)'\)/);
    const releaseDate = dateM ? dateM[1] : null;

    // Clean title = text after chapter number
    const cleanTitle = text.replace(/(?:episode|chapter|ch)[\s.]*\d+(?:\.\d+)?\s*[-–—]?\s*/i, "").trim();

    chapters.push({
      id: chId,
      number: num,
      title: cleanTitle || `Chapter ${num}`,
      releaseDate,
    });
  });

  return chapters.sort((a, b) => b.number - a.number);
}

function parseSeriesPage(html: string, id: string): (WCSeries & { description: string; authors: string[]; chapters: WCChapter[]; totalChapters: number }) | null {
  const $ = cheerio.load(html);

  let title = $("h1").first().text().trim()
    || $("title").first().text().replace(/\s*[-|].*$/, "").trim();

  // Cover from og:image or picture element
  let coverUrl = $("meta[property='og:image']").attr("content") ?? "";
  if (!coverUrl) {
    coverUrl = $("picture img").first().attr("src") ?? "";
    if (!coverUrl) coverUrl = $("img[src*='cover']").first().attr("src") ?? "";
  }
  if (!coverUrl) coverUrl = coverFromId(id);
  if (coverUrl && !coverUrl.startsWith("http")) coverUrl = `${WC_BASE}${coverUrl}`;

  const description = $("meta[name='description']").attr("content")?.trim()
    || $("meta[property='og:description']").attr("content")?.trim()
    || $("[class*='description'], [class*='synopsis']").first().text().trim()
    || "";

  let status = "Ongoing";
  const statusM = html.match(/(?:Status|status)[:\s<>"/a-z]*?>(Ongoing|Completed|Hiatus|Cancelled|Dropped)/i);
  if (statusM) status = statusM[1];

  let type = "Manga";
  const typeM = html.match(/(?:Type|Format)[:\s<>"/a-z]*?>(Manga|Manhwa|Manhua|One-Shot)/i);
  if (typeM) type = typeM[1];

  const genres: string[] = [];
  $("[class*='genre'] a, [href*='/search?included_tag']").each((_, el) => {
    const g = $(el).text().trim();
    if (g && g.length < 40) genres.push(g);
  });

  const authors: string[] = [];
  $("[class*='author'] a, [href*='/search?author']").each((_, el) => {
    const a = $(el).text().trim();
    if (a) authors.push(a);
  });

  if (!title || title.length < 2) return null;

  return {
    id,
    title,
    coverUrl,
    type,
    status,
    genres: [...new Set(genres)].slice(0, 10),
    authors: [...new Set(authors)],
    description,
    latestChapter: null,
    chapters: [],
    totalChapters: 0,
  };
}

async function fetchChapterImages(chapterId: string): Promise<{ pages: string[]; embedUrl: string }> {
  const url = `/chapters/${chapterId}/images?is_prev=False&current_page=1`;
  const html = await wcFetch(url, { "HX-Current-URL": `${WC_BASE}/chapters/${chapterId}` });

  const $ = cheerio.load(html);
  const pages: string[] = [];

  $("img[src]").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (src && src.startsWith("http") && !src.includes("/static/") && !src.includes("brand") && !src.includes("logo")) {
      pages.push(src);
    }
  });
  $("img[data-src]").each((_, el) => {
    const src = $(el).attr("data-src") ?? "";
    if (src && src.startsWith("http") && !pages.includes(src)) pages.push(src);
  });

  const embedUrl = pages.length === 0 ? `${WC_BASE}/chapters/${chapterId}` : "";
  return { pages, embedUrl };
}

// ── GET /weebcentral/home ──────────────────────────────────────────────────────
router.get("/weebcentral/home", async (_req, res): Promise<void> => {
  try {
    const data = await withCache("wc:home", TTL_HOME, fetchHomePage);
    res.json(data);
  } catch (err) {
    console.error("[WeebCentral] home error:", err);
    res.status(502).json({ error: String(err), featured: [], popular: [], latest: [] });
  }
});

// ── GET /weebcentral/popular?page=1 ───────────────────────────────────────────
router.get("/weebcentral/popular", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  try {
    const homeData = await withCache("wc:home", TTL_HOME, fetchHomePage);
    res.json({ items: homeData.popular, page, hasMore: false });
  } catch (err) {
    res.status(502).json({ error: String(err), items: [], page, hasMore: false });
  }
});

// ── GET /weebcentral/latest?page=1 ────────────────────────────────────────────
router.get("/weebcentral/latest", async (req, res): Promise<void> => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  try {
    const homeData = await withCache("wc:home", TTL_HOME, fetchHomePage);
    res.json({ items: homeData.latest, page, hasMore: false });
  } catch (err) {
    res.status(502).json({ error: String(err), items: [], page, hasMore: false });
  }
});

// ── GET /weebcentral/search?q= ─────────────────────────────────────────────────
router.get("/weebcentral/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const cacheKey = `wc:search:${q}:${page}`;
  try {
    const items = await withCache(cacheKey, TTL_BROWSE, async () => {
      if (!q) {
        const home = await fetchHomePage();
        return home.latest;
      }
      // POST to simple search for text queries
      const html = await wcFetch(
        `/search/simple?location=main`,
        { "HX-Current-URL": `${WC_BASE}/search` },
        "POST",
        `text=${encodeURIComponent(q)}`
      );
      return parseSimpleSearchResults(html);
    });
    res.json({ items, page, total: items.length, hasMore: false });
  } catch (err) {
    res.status(502).json({ error: String(err), items: [], page, total: 0, hasMore: false });
  }
});

// ── GET /weebcentral/filter?status=&genres= ────────────────────────────────────
// WeebCentral's advanced search/data endpoint is blocked server-side, so we
// fall back to POST /search/simple using the first genre (or status) as a
// keyword search.  Results approximate genre filtering.
router.get("/weebcentral/filter", async (req, res): Promise<void> => {
  const genres = String(req.query.genres ?? "").trim();
  const genreList = genres ? genres.split(",").map((g) => g.trim()).filter(Boolean) : [];
  const searchText = genreList[0] ?? "";
  if (!searchText) {
    res.json({ items: [], page: 1, total: 0, hasMore: false });
    return;
  }
  const cacheKey = `wc:filter3:${searchText}`;
  try {
    const items = await withCache(cacheKey, TTL_BROWSE, async () => {
      const body = new URLSearchParams({ text: searchText }).toString();
      const html = await wcFetch("/search/simple?location=main", { "HX-Current-URL": `${WC_BASE}/search` }, "POST", body);
      return parseSimpleSearchResults(html);
    });
    res.json({ items, page: 1, total: items.length, hasMore: false });
  } catch (err) {
    res.status(502).json({ error: String(err), items: [], page: 1, total: 0, hasMore: false });
  }
});

// ── GET /weebcentral/series/:id ────────────────────────────────────────────────
router.get("/weebcentral/series/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const data = await withCache(`wc:series:${id}`, TTL_SERIES, async () => {
      const [seriesHtml, chapterHtml] = await Promise.all([
        wcFetch(`/series/${id}`, { "HX-Current-URL": `${WC_BASE}/series/${id}` }),
        wcFetch(`/series/${id}/full-chapter-list`, {
          "HX-Current-URL": `${WC_BASE}/series/${id}`,
          "HX-Target": "chapter-list",
        }).catch(() => ""),
      ]);

      const parsed = parseSeriesPage(seriesHtml, id);
      if (!parsed) throw new Error("Could not parse series");

      const chapters = chapterHtml ? parseChapterList(chapterHtml) : parseChapterList(seriesHtml);
      parsed.chapters = chapters;
      parsed.totalChapters = chapters.length;
      if (chapters.length > 0) {
        parsed.latestChapter = `Ch. ${chapters[0].number}`;
      }
      return parsed;
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// ── GET /weebcentral/chapters/:id — chapter list ──────────────────────────────
router.get("/weebcentral/chapters/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const data = await withCache(`wc:chapters:${id}`, TTL_CHAPTER, async () => {
      const html = await wcFetch(`/series/${id}/full-chapter-list`, {
        "HX-Current-URL": `${WC_BASE}/series/${id}`,
        "HX-Target": "chapter-list",
      }).catch(() => wcFetch(`/series/${id}`));
      return { chapters: parseChapterList(html) };
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: String(err), chapters: [] });
  }
});

// ── GET /weebcentral/read/:chapterId — chapter images ─────────────────────────
router.get("/weebcentral/read/:chapterId", async (req, res): Promise<void> => {
  const { chapterId } = req.params;
  try {
    const data = await withCache(`wc:read:${chapterId}`, TTL_IMAGES, () => fetchChapterImages(chapterId));
    res.json({ ...data, chapterId });
  } catch (err) {
    res.status(502).json({ error: String(err), pages: [], embedUrl: `${WC_BASE}/chapters/${chapterId}`, chapterId });
  }
});

// ── GET /weebcentral/proxy-image — proxy covers and chapter images ─────────────
router.get("/weebcentral/proxy-image", async (req, res): Promise<void> => {
  const url = String(req.query.url ?? "");
  if (!url.startsWith("http")) { res.status(400).end(); return; }
  try {
    const imgRes = await fetch(url, {
      headers: {
        "Referer": `${WC_BASE}/`,
        "User-Agent": WC_HEADERS["User-Agent"] ?? "",
        "Accept": "image/webp,image/avif,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!imgRes.ok) { res.status(imgRes.status).end(); return; }
    const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
    res.set("Content-Type", ct.includes("image/") ? ct : "image/jpeg");
    res.set("Cache-Control", "public, max-age=604800, immutable");
    res.send(Buffer.from(await imgRes.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});

// Background pre-warm
setImmediate(() => {
  withCache("wc:home", TTL_HOME, fetchHomePage).catch(() => {});
});

export default router;
