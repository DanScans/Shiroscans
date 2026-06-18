import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";

const router: IRouter = Router();

// ─── In-memory cache ──────────────────────────────────────────────────────────
const _cache = new Map<string, { data: unknown; expiresAt: number }>();
function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const MF_BASE = "https://mangafire.to";
const MF_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": `${MF_BASE}/`,
};
const MF_AJAX_HEADERS: Record<string, string> = {
  ...MF_HEADERS,
  "X-Requested-With": "XMLHttpRequest",
  "Accept": "application/json, text/javascript, */*; q=0.01",
};

async function mfFetch(path: string, ajax = false): Promise<string> {
  const url = path.startsWith("http") ? path : `${MF_BASE}${path}`;
  const res = await fetch(url, {
    headers: ajax ? MF_AJAX_HEADERS : MF_HEADERS,
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`MangaFire ${path} → ${res.status}`);
  return res.text();
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface MFManga {
  id: string;
  slug: string;
  title: string;
  coverUrl: string;
  type: string;
  status: string | null;
  rating: number | null;
  latestChapter: string | null;
  genres: string[];
  updatedAt: string | null;
  chapters?: Array<{ label: string; id: string; timeAgo: string }>;
}

// ─── parseMangaCard — uses real MangaFire HTML structure ──────────────────────
// Actual card HTML:
//   <div class="unit item-{numericId}">
//     <a href="/manga/{slug}" class="poster"><div><img src="..." alt="Title"></div></a>
//     <div class="info">
//       <div><span class="type">Manhwa</span></div>
//       <a href="/manga/{slug}">Title</a>
//       <ul class="content" data-name="chap">
//         <li><a href="/read/{slug}/en/chapter-329"><span>Chap 329 <b>EN</b></span><span>2 hours ago</span></a></li>
//       </ul>
//     </div>
//   </div>
function parseMangaCard($: cheerio.CheerioAPI, el: cheerio.Element): MFManga | null {
  try {
    const $el = $(el);

    // Numeric ID from class "unit item-{id}"
    const classAttr = $el.attr("class") ?? "";
    const idFromClass = classAttr.match(/\bitem-(\d+)\b/)?.[1] ?? "";

    // Slug from poster anchor href
    const posterHref =
      $el.find("a.poster").attr("href") ??
      $el.find("a[href*='/manga/']").first().attr("href") ?? "";
    const slugMatch = posterHref.match(/\/manga\/([^/?#\s]+)/);
    const slug = slugMatch?.[1] ?? "";
    if (!slug) return null;

    // Cover image
    const coverUrl =
      $el.find("a.poster img").attr("src") ??
      $el.find("img").first().attr("src") ??
      $el.find("img").first().attr("data-src") ?? "";

    // Title from info section link text, fallback to img alt
    const title =
      $el.find(".info a[href*='/manga/']").first().text().trim() ||
      ($el.find("img").first().attr("alt") ?? "");
    if (!title) return null;

    // Type — actual text "Manga" | "Manhwa" | "Manhua"
    const typeRaw = $el.find(".type").first().text().trim();
    let type = "Manga";
    if (typeRaw) {
      const tl = typeRaw.toLowerCase();
      if (tl.includes("manhwa")) type = "Manhwa";
      else if (tl.includes("manhua")) type = "Manhua";
      else type = typeRaw;
    }

    // Latest chapter from first chap-list entry
    const firstLi = $el.find("ul.content[data-name='chap'] li").first();
    const firstLink = firstLi.find("a");
    const spans = firstLink.find("span");
    // "Chap 329 EN" — strip inner <b> text noise
    const rawChap = spans.first().clone().find("b").remove().end().text().trim();
    const latestChapter = rawChap || spans.first().text().trim() || null;
    const updatedAt = spans.eq(1).text().trim() || null;

    // Chapter read URL → becomes our chapterId
    const chapterHref = firstLink.attr("href") ?? "";
    const chapters: Array<{ label: string; id: string; timeAgo: string }> = [];
    $el.find("ul.content[data-name='chap'] li").each((i, li) => {
      if (i >= 3) return;
      const a = $(li).find("a");
      const href = a.attr("href") ?? "";
      const chIdMatch = href.match(/^\/read\/(.+)/);
      const chId = chIdMatch?.[1] ?? href;
      const sp = a.find("span");
      const label = sp.first().text().trim().replace(/\s+/g, " ");
      const timeAgo = sp.eq(1).text().trim();
      if (chId) chapters.push({ label, id: chId, timeAgo });
    });

    // ID: prefer numeric class id, fallback to suffix of slug
    const id = idFromClass || (slug.match(/\.([a-z0-9]+)$/i)?.[1] ?? slug);

    return {
      id, slug, title, coverUrl, type,
      status: null, rating: null,
      latestChapter: latestChapter ?? (chapters[0]?.label ?? null),
      genres: [], updatedAt,
      chapters: chapters.length ? chapters : undefined,
    };
  } catch { return null; }
}

// ─── GET /api/mangafire/home ───────────────────────────────────────────────────
// Uses /filter pages (more reliable than /home which can time-out or be JS-rendered)
router.get("/mangafire/home", async (req, res): Promise<void> => {
  try {
    const data = await withCache("mf:home", 5 * 60_000, async () => {
      // Fetch trending for featured + recently updated for latest in parallel
      const [trendHtml, latestHtml] = await Promise.all([
        mfFetch("/filter?sort=trending&page=1"),
        mfFetch("/filter?sort=recently_updated&page=1"),
      ]);

      const $t = cheerio.load(trendHtml);
      const $l = cheerio.load(latestHtml);

      const featured: MFManga[] = [];
      const latest: MFManga[] = [];

      $t(".unit").each((_, el) => {
        const item = parseMangaCard($t, el);
        if (item && featured.length < 20) featured.push(item);
      });

      $l(".unit").each((_, el) => {
        const item = parseMangaCard($l, el);
        if (item) latest.push(item);
      });

      return { featured, latest };
    });

    res.setHeader("Cache-Control", "public, max-age=240, s-maxage=300");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire home failed");
    res.json({ featured: [], latest: [] });
  }
});

// ─── GET /api/mangafire/trending-today ───────────────────────────────────────
router.get("/mangafire/trending-today", async (req, res): Promise<void> => {
  try {
    const data = await withCache("mf:trending-today", 10 * 60_000, async () => {
      const html = await mfFetch("/filter?sort=trending&page=1");
      const $ = cheerio.load(html);
      const items: MFManga[] = [];
      $(".unit").each((_, el) => {
        const item = parseMangaCard($, el);
        if (item && items.length < 4) items.push(item);
      });
      return { items };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire trending-today failed");
    res.json({ items: [] });
  }
});

// ─── GET /api/mangafire/latest ────────────────────────────────────────────────
router.get("/mangafire/latest", async (req, res): Promise<void> => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const cacheKey = `mf:latest:${page}`;
  try {
    const data = await withCache(cacheKey, 3 * 60_000, async () => {
      const html = await mfFetch(`/filter?sort=recently_updated&page=${page}`);
      const $ = cheerio.load(html);
      const items: MFManga[] = [];

      $(".unit").each((_, el) => {
        const item = parseMangaCard($, el);
        if (item) items.push(item);
      });

      // Pagination: last page number from ".page-item a" links
      let totalPages = 1;
      $(".page-item a, .pagination a").each((_, el) => {
        const n = parseInt($(el).text().trim());
        if (!isNaN(n) && n > totalPages) totalPages = n;
      });

      return { items, page, hasMore: items.length >= 20, totalPages: Math.max(totalPages, page + 1) };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire latest failed");
    res.json({ items: [], page, hasMore: false, totalPages: 1 });
  }
});

// ─── GET /api/mangafire/popular ───────────────────────────────────────────────
// /top is JS-rendered; use /filter?sort= instead
router.get("/mangafire/popular", async (req, res): Promise<void> => {
  const period = String(req.query.period ?? "weekly");
  const cacheKey = `mf:popular:${period}`;
  const sortMap: Record<string, string> = { weekly: "trending", monthly: "popular", alltime: "rating" };
  const sort = sortMap[period] ?? "trending";

  try {
    const data = await withCache(cacheKey, 15 * 60_000, async () => {
      const html = await mfFetch(`/filter?sort=${sort}&page=1`);
      const $ = cheerio.load(html);
      const items: MFManga[] = [];
      $(".unit").each((_, el) => {
        const item = parseMangaCard($, el);
        if (item && items.length < 10) items.push(item);
      });
      return { items, period };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire popular failed");
    res.json({ items: [], period });
  }
});

// ─── GET /api/mangafire/series/:slug ──────────────────────────────────────────
// Actual series HTML structure (confirmed):
//   .info > p                    → "Releasing" (status)
//   h1[itemprop="name"]          → title
//   div.poster img               → cover
//   [data-score]                 → "8.97" (MF rating)
//   .description                 → synopsis
//   a[href*="/genre/"]           → genre links
//   a[href*="/type/"]            → type
//   [itemprop="author"] / a[href*="/author/"]  → author
//   script JSON: "manga_id":16997 → numeric manga ID
router.get("/mangafire/series/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const cacheKey = `mf:series:${slug}`;

  try {
    const data = await withCache(cacheKey, 10 * 60_000, async () => {
      const html = await mfFetch(`/manga/${slug}`);
      const $ = cheerio.load(html);

      // Title
      const title =
        $("h1[itemprop='name']").text().trim() ||
        $("h1.name, h1.title, h1").first().text().trim();

      // Cover
      const coverUrl =
        $("div.poster img").first().attr("src") ||
        $(".poster img").first().attr("src") || "";

      // Status: .info > p first text child — "Releasing" → Ongoing
      const statusRaw = $(".info > p").first().text().trim() ||
                        $(".info p").first().text().trim();
      let status = "Ongoing";
      const sl = statusRaw.toLowerCase();
      if (sl.includes("complet")) status = "Completed";
      else if (sl.includes("hiatus")) status = "Hiatus";
      else if (sl.includes("drop") || sl.includes("axed") || sl.includes("cancel")) status = "Dropped";

      // Rating from data-score attribute (MangaFire own rating)
      const ratingAttr = $("[data-score]").first().attr("data-score") ?? "";
      const rating = ratingAttr ? parseFloat(ratingAttr) : null;

      // Description
      const description = $(".description").text().trim() ||
                          $("[class*='description'], [class*='summary']").first().text().trim();

      // Genres are inside .meta > div > span > a[href*='/genre/']
      // Using .meta scope avoids picking up the full site-nav genre list
      const genreSet = new Set<string>();
      $(".meta a[href*='/genre/']").each((_, el) => {
        const g = $(el).text().trim();
        if (g) genreSet.add(g);
      });
      const genres = Array.from(genreSet);

      // Type from /type/ link in .min-info
      const typeRaw =
        $(".min-info a[href*='/type/']").first().text().trim() ||
        $("a[href*='/type/']").first().text().trim();
      let type = "Manga";
      const tl = typeRaw.toLowerCase();
      if (tl.includes("manhwa")) type = "Manhwa";
      else if (tl.includes("manhua")) type = "Manhua";
      else if (typeRaw) type = typeRaw;

      // Author(s)
      const authors: string[] = [];
      $("[itemprop='author'], a[href*='/author/']").each((_, el) => {
        const name = $(el).text().trim();
        if (name && !authors.includes(name)) authors.push(name);
      });
      const author = authors.join(", ");

      // Numeric manga ID for AJAX chapter list (from inline script JSON)
      const mangaIdMatch =
        html.match(/"manga_id"\s*:\s*(\d+)/) ||
        html.match(/manga_id['":\s]+(\d+)/);
      const mangaId = mangaIdMatch?.[1] ?? "";

      // Alt titles from h6 (contains alternative language titles)
      const altTitlesRaw = $("h6").first().text().trim();
      const altTitles = altTitlesRaw
        ? altTitlesRaw.split(/[;,]/).map((t) => t.trim()).filter(Boolean)
        : [];

      // Chapter count hint from visible read links
      const readLinksCount = $("a[href*='/read/'][href*='/en/chapter-']").length;

      return {
        slug, mangaId, title, coverUrl, description,
        type, status, rating, genres, altTitles, author,
        totalChapters: readLinksCount,
      };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire series failed");
    res.status(500).json({ error: "Failed to load series" });
  }
});

// ─── GET /api/mangafire/chapters-by-slug/:slug ────────────────────────────────
// Parses chapter list directly from the series HTML — no AJAX needed.
// Series page contains ALL chapter read links:
//   <a href="/read/{slug}/en/chapter-{N}">...</a>
// Chapter ID format in our system: "{slug}/en/chapter-{N}"
router.get("/mangafire/chapters-by-slug/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const cacheKey = `mf:chapters-slug:${slug}`;

  try {
    const data = await withCache(cacheKey, 5 * 60_000, async () => {
      const html = await mfFetch(`/manga/${slug}`);
      const $ = cheerio.load(html);

      // Collect unique chapter IDs from read links matching /read/{slug}/en/chapter-{N}
      const chapMap = new Map<string, { id: string; number: number; title: string; releaseDate: string | null }>();

      $("a[href*='/read/']").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        // Match /read/{slug}/en/chapter-{number}
        const m = href.match(/^\/read\/([^/]+\/en\/chapter-[\d.]+(?:\.\d+)?)/);
        if (!m) return;
        const chId = m[1]!; // e.g. "blue-lockk.kw9j9/en/chapter-350"
        if (chapMap.has(chId)) return; // dedupe

        const numM = chId.match(/chapter-([\d.]+)$/);
        const number = numM ? parseFloat(numM[1]!) : 0;
        if (number === 0) return;

        // Try to get release date from sibling span in same li
        const $li = $(el).closest("li");
        const releaseDate = $li.find("span, time").last().text().trim() || null;

        chapMap.set(chId, {
          id: chId,
          number,
          title: `Chapter ${number}`,
          releaseDate,
        });
      });

      // Sort descending by chapter number (newest first)
      const chapters = Array.from(chapMap.values()).sort((a, b) => b.number - a.number);

      // Also get manga ID in case it's needed
      const mangaIdMatch = html.match(/"manga_id"\s*:\s*(\d+)/);
      const mangaId = mangaIdMatch?.[1] ?? "";

      return { chapters, total: chapters.length, mangaId };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire chapters-by-slug failed");
    res.json({ chapters: [], total: 0 });
  }
});

// ─── GET /api/mangafire/chapters/:mangaId ────────────────────────────────────
// Kept for compatibility; redirects to HTML parse via slug if possible
router.get("/mangafire/chapters/:mangaId", async (req, res): Promise<void> => {
  res.json({ chapters: [], total: 0, note: "Use chapters-by-slug instead" });
});

// ─── GET /api/mangafire/read/:chapterId ───────────────────────────────────────
// chapterId is URL-encoded by the frontend (slashes become %2F).
// The reader images AJAX on MangaFire requires a Cloudflare session cookie that
// is tied to a browser challenge — not obtainable server-side.
// Strategy:
//   1. Try to extract images from page HTML (lazy-loaded img/data-src)
//   2. Return embedUrl so the frontend can display the MangaFire reader in an iframe
router.get("/mangafire/read/:chapterId", async (req, res): Promise<void> => {
  const rawId = req.params.chapterId ?? "";
  const chapterId = decodeURIComponent(rawId);
  const cacheKey = `mf:read:${chapterId}`;

  try {
    const data = await withCache(cacheKey, 30 * 60_000, async () => {
      const pages: string[] = [];
      const readUrl = `${MF_BASE}/read/${chapterId}`;

      // Try to scrape page images from the reader HTML
      try {
        const html = await mfFetch(`/read/${chapterId}`);
        const $ = cheerio.load(html);

        // Some mirrors embed lazy-loaded images directly
        $("img[data-src], img[data-lazy-src], img.page-img").each((_, el) => {
          const src = $(el).attr("data-src") || $(el).attr("data-lazy-src") || "";
          if (src && src.startsWith("http")) pages.push(src);
        });

        // Try img[src] that look like chapter pages (CDN patterns)
        // Exclude asset/logo images (e.g. s.mfcdn.nl/assets/...)
        if (pages.length === 0) {
          $("img").each((_, el) => {
            const src = $(el).attr("src") || "";
            if (src && (src.includes("mfcdn") || src.includes("mangafire")) &&
                (src.includes(".jpg") || src.includes(".webp") || src.includes(".png")) &&
                !src.includes("/assets/")) {
              pages.push(src);
            }
          });
        }

        // Try extracting from inline JSON / script tags
        if (pages.length === 0) {
          const imgPattern = /"(https:\/\/[^"]+(?:mfcdn|cdn)[^"]+\.(?:jpg|jpeg|webp|png))"/gi;
          let m: RegExpExecArray | null;
          while ((m = imgPattern.exec(html)) !== null) {
            const url = m[1]!;
            if (!pages.includes(url)) pages.push(url);
          }
        }
      } catch {
        // Scraping the reader page failed — embedUrl fallback will be used
      }

      return { pages, chapterId, embedUrl: readUrl };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire read failed");
    const readUrl = `${MF_BASE}/read/${chapterId}`;
    res.json({ pages: [], chapterId, embedUrl: readUrl });
  }
});

// ─── GET /api/mangafire/search ────────────────────────────────────────────────
router.get("/mangafire/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const sort = String(req.query.sort ?? "recently_updated");
  const status = String(req.query.status ?? "");
  const type = String(req.query.type ?? "");
  const genres = String(req.query.genres ?? "");
  const cacheKey = `mf:search:${q}:${page}:${sort}:${status}:${type}:${genres}`;

  const sortMap: Record<string, string> = {
    recently_updated: "recently_updated",
    popular: "trending",
    rating: "rating",
    "a-z": "a-z",
    newest: "newest",
  };
  const statusMap: Record<string, string> = { ongoing: "1", completed: "2", hiatus: "3", dropped: "4" };
  const typeMap: Record<string, string> = { manga: "1", manhwa: "2", manhua: "3" };

  try {
    const data = await withCache(cacheKey, 3 * 60_000, async () => {
      const params = new URLSearchParams();
      if (q) params.set("keyword", q);
      params.set("sort", sortMap[sort] ?? "recently_updated");
      params.set("page", String(page));
      if (status && statusMap[status.toLowerCase()]) params.append("status[]", statusMap[status.toLowerCase()]!);
      if (type && typeMap[type.toLowerCase()]) params.append("type[]", typeMap[type.toLowerCase()]!);
      if (genres) {
        for (const g of genres.split(",")) {
          if (g.trim()) params.append("genre[]", g.trim());
        }
      }

      const html = await mfFetch(`/filter?${params.toString()}`);
      const $ = cheerio.load(html);
      const items: MFManga[] = [];

      $(".unit").each((_, el) => {
        const item = parseMangaCard($, el);
        if (item) items.push(item);
      });

      let totalPages = 1;
      $(".page-item a, .pagination a").each((_, el) => {
        const n = parseInt($(el).text().trim());
        if (!isNaN(n) && n > totalPages) totalPages = n;
      });

      return { items, page, hasMore: items.length >= 20, totalPages };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire search failed");
    res.json({ items: [], page, hasMore: false, totalPages: 1 });
  }
});

export default router;
