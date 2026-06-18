import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";

const router: IRouter = Router();

const _cache = new Map<string, { data: unknown; expiresAt: number }>();
function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

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
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`MangaFire ${path} returned ${res.status}`);
  return res.text();
}

async function mfFetchJson<T = unknown>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${MF_BASE}${path}`;
  const res = await fetch(url, {
    headers: MF_AJAX_HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`MangaFire JSON ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

function extractMangaId(href: string): string {
  const m = href.match(/\/manga\/([^/?#]+)/);
  return m ? m[1]! : href;
}

function extractIdSuffix(slug: string): string {
  const m = slug.match(/\.([a-z0-9]+)$/i);
  return m ? m[1]! : slug;
}

function parseRating(text: string): number | null {
  const n = parseFloat(text.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

function starsFromRating(r: number | null): string {
  if (r === null) return "";
  if (r >= 9.5) return "⭐⭐⭐⭐⭐";
  if (r >= 9.0) return "⭐⭐⭐⭐½";
  if (r >= 8.5) return "⭐⭐⭐⭐";
  if (r >= 8.0) return "⭐⭐⭐½";
  if (r >= 7.5) return "⭐⭐⭐";
  if (r >= 7.0) return "⭐⭐½";
  if (r >= 6.0) return "⭐⭐";
  return "⭐";
}

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
}

function parseMangaCard($: cheerio.CheerioAPI, el: cheerio.Element): MFManga | null {
  try {
    const $el = $(el);
    const linkEl = $el.find("a").first();
    const href = linkEl.attr("href") ?? $el.attr("href") ?? "";
    const slug = extractMangaId(href);
    if (!slug) return null;

    const title =
      $el.find(".title, h3, h2, .name, [class*='title']").first().text().trim() ||
      $el.find("a").attr("title") ||
      $el.find("img").attr("alt") ||
      "";
    if (!title) return null;

    const coverUrl =
      $el.find("img").attr("src") ||
      $el.find("img").attr("data-src") ||
      $el.find("img").attr("data-lazy-src") ||
      "";

    const ratingText = $el.find(".rating, .score, [class*='rating'], [class*='score']").first().text().trim();
    const rating = parseRating(ratingText);

    const chapterEl = $el.find(".chapter, [class*='chapter'], .lastest-chapter").first();
    const latestChapter = chapterEl.text().trim() || null;

    const typeText = $el.find(".type, [class*='type'], .badge-type").first().text().trim().toLowerCase();
    let type = "Manga";
    if (typeText.includes("manhwa") || typeText.includes("korean")) type = "Manhwa";
    else if (typeText.includes("manhua") || typeText.includes("chinese")) type = "Manhua";

    const statusText = $el.find(".status, [class*='status']").first().text().trim();

    return { id: extractIdSuffix(slug), slug, title, coverUrl, type, status: statusText || null, rating, latestChapter, genres: [], updatedAt: null };
  } catch { return null; }
}

// ─── GET /api/mangafire/home ──────────────────────────────────────────────────
router.get("/mangafire/home", async (req, res): Promise<void> => {
  try {
    const data = await withCache("mf:home", 5 * 60_000, async () => {
      const html = await mfFetch("/home");
      const $ = cheerio.load(html);

      const featured: MFManga[] = [];
      const trending: MFManga[] = [];
      const latest: MFManga[] = [];

      // Extract from swiper/slider sections (featured carousel)
      $(".swiper-slide, [class*='slider'] .unit, [class*='featured'] .unit, [class*='carousel'] .unit").each((_, el) => {
        const item = parseMangaCard($, el);
        if (item && featured.length < 20) featured.push(item);
      });

      // Extract trending / popular today section
      $("[class*='trend'] .unit, [class*='popular'] .unit, [class*='trending'] .unit, .trending .unit").each((_, el) => {
        const item = parseMangaCard($, el);
        if (item && trending.length < 10) trending.push(item);
      });

      // If trending is empty try a broader selector
      if (trending.length === 0) {
        $(".section:first-of-type .unit, .units .unit").each((_, el) => {
          const item = parseMangaCard($, el);
          if (item && trending.length < 10) trending.push(item);
        });
      }

      // Extract latest updates section
      $("[class*='latest'] .unit, [class*='update'] .unit, [class*='recent'] .unit").each((_, el) => {
        const item = parseMangaCard($, el);
        if (item) latest.push(item);
      });

      // Parse chapter updates with time info from list items
      const latestWithTime: Array<MFManga & { chapters: Array<{ label: string; id: string; timeAgo: string }> }> = [];
      $("[class*='latest'] .item, [class*='update'] li, [class*='recent'] li, .manga-item").each((_, el) => {
        const $el = $(el);
        const href = $el.find("a").first().attr("href") ?? "";
        const slug = extractMangaId(href);
        if (!slug) return;
        const title = $el.find(".title, .name, h3, h2").first().text().trim() || $el.find("a").attr("title") || "";
        if (!title) return;
        const coverUrl = $el.find("img").attr("src") || $el.find("img").attr("data-src") || "";
        const chapters: Array<{ label: string; id: string; timeAgo: string }> = [];
        $el.find("a[href*='chapter'], [class*='chapter'] a").each((i, cel) => {
          if (i >= 3) return;
          const chHref = $(cel).attr("href") ?? "";
          const chId = chHref.split("/").pop() ?? "";
          const label = $(cel).text().trim();
          const timeEl = $(cel).closest("li, [class*='item']").find("[class*='time'], time, .date").text().trim();
          chapters.push({ label, id: chId, timeAgo: timeEl });
        });
        const ratingText = $el.find(".rating, .score").text().trim();
        const rating = parseRating(ratingText);
        latestWithTime.push({
          id: extractIdSuffix(slug), slug, title, coverUrl, type: "Manhwa", status: null, rating, latestChapter: chapters[0]?.label ?? null, genres: [], updatedAt: null, chapters,
        });
      });

      // Fallback: if we couldn't parse structured sections, parse all .unit elements
      if (trending.length === 0 && latest.length === 0) {
        $(".unit").each((i, el) => {
          const item = parseMangaCard($, el);
          if (!item) return;
          if (i < 10) trending.push(item);
          else latest.push(item);
        });
      }

      return { featured, trending: trending.slice(0, 10), latest: latestWithTime.length > 0 ? latestWithTime : latest, latestRaw: latest };
    });

    res.setHeader("Cache-Control", "public, max-age=240, s-maxage=300");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire home failed");
    res.json({ featured: [], trending: [], latest: [] });
  }
});

// ─── GET /api/mangafire/trending-today ───────────────────────────────────────
router.get("/mangafire/trending-today", async (req, res): Promise<void> => {
  try {
    const data = await withCache("mf:trending-today", 10 * 60_000, async () => {
      const html = await mfFetch("/home");
      const $ = cheerio.load(html);
      const items: MFManga[] = [];
      $(".unit, .manga-unit").each((_, el) => {
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
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const cacheKey = `mf:latest:${page}`;
  try {
    const data = await withCache(cacheKey, 3 * 60_000, async () => {
      const html = await mfFetch(`/filter?sort=recently_updated&page=${page}`);
      const $ = cheerio.load(html);
      const items: Array<MFManga & { chapters?: Array<{ label: string; id: string; timeAgo: string }> }> = [];

      // Try to find list-style latest updates (with chapters + time)
      $(".manga-item, .list-item, [class*='update'] .item").each((_, el) => {
        const $el = $(el);
        const href = $el.find("a[href*='/manga/']").first().attr("href") ?? "";
        const slug = extractMangaId(href);
        if (!slug) return;
        const title = $el.find(".title, .name, h3").first().text().trim() || "";
        if (!title) return;
        const coverUrl = $el.find("img").attr("src") || $el.find("img").attr("data-src") || "";
        const ratingText = $el.find(".rating, .score").text().trim();
        const rating = parseRating(ratingText);
        const chapters: Array<{ label: string; id: string; timeAgo: string }> = [];
        $el.find("a[href*='chapter']").each((i, cel) => {
          if (i >= 3) return;
          const chHref = $(cel).attr("href") ?? "";
          const chId = chHref.split("/").pop() ?? "";
          const label = $(cel).text().trim();
          const timeEl = $(cel).parent().find("time, .date, [class*='time']").text().trim();
          chapters.push({ label, id: chId, timeAgo: timeEl });
        });
        items.push({ id: extractIdSuffix(slug), slug, title, coverUrl, type: "Manhwa", status: null, rating, latestChapter: chapters[0]?.label ?? null, genres: [], updatedAt: null, chapters });
      });

      // Fallback: grid cards
      if (items.length === 0) {
        $(".unit, .manga-unit").each((_, el) => {
          const item = parseMangaCard($, el);
          if (item) items.push(item);
        });
      }

      const totalPages = parseInt($("[class*='pagination'] li:last-child a, .page-item:last-child a").text().trim() || "1");
      return { items: items.slice(0, 20), page, hasMore: items.length >= 20, totalPages: isNaN(totalPages) ? 5 : totalPages };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire latest failed");
    res.json({ items: [], page, hasMore: false, totalPages: 1 });
  }
});

// ─── GET /api/mangafire/popular ───────────────────────────────────────────────
router.get("/mangafire/popular", async (req, res): Promise<void> => {
  const period = String(req.query.period ?? "weekly");
  const cacheKey = `mf:popular:${period}`;
  // Map period to filter sort param — /top page is JS-rendered; use /filter instead
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

// ─── GET /api/mangafire/series/:slug ─────────────────────────────────────────
router.get("/mangafire/series/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const cacheKey = `mf:series:${slug}`;

  try {
    const data = await withCache(cacheKey, 10 * 60_000, async () => {
      const html = await mfFetch(`/manga/${slug}`);
      const $ = cheerio.load(html);

      const title = $("h1.name, h1.title, .manga-name h1, .series-name, h1").first().text().trim();
      const coverUrl = $(".poster img, .cover img, .manga-poster img, .series-poster img").first().attr("src") ||
        $("img.poster, img.cover, img[class*='poster']").first().attr("src") || "";

      const description = $(".description, .summary, .manga-description, [class*='description'], [class*='summary']").first().text().trim();

      const statusText = $(".status, [class*='status']").first().text().trim();
      const typeText = $(".type, [class*='type'], .badge-type").first().text().trim();

      let type = "Manga";
      const tl = typeText.toLowerCase();
      if (tl.includes("manhwa")) type = "Manhwa";
      else if (tl.includes("manhua")) type = "Manhua";

      let status = "Ongoing";
      const sl = statusText.toLowerCase();
      if (sl.includes("completed")) status = "Completed";
      else if (sl.includes("hiatus")) status = "Hiatus";
      else if (sl.includes("dropped") || sl.includes("axed")) status = "Dropped";

      const ratingText = $(".score, .rating, [class*='score'], [class*='rating']").first().text().trim();
      const rating = parseRating(ratingText);

      const genres: string[] = [];
      $(".genres a, .genre a, [class*='genre'] a, .tags a").each((_, el) => {
        const g = $(el).text().trim();
        if (g) genres.push(g);
      });

      const altTitles: string[] = [];
      $(".alt-title, .alternative, [class*='alt-title']").each((_, el) => {
        const t = $(el).text().trim();
        if (t) altTitles.push(t);
      });

      const author = $(".author a, [class*='author'] a").first().text().trim() ||
        $(".author, [class*='author']").first().text().replace(/author:/i, "").trim();
      const artist = $(".artist a, [class*='artist'] a").first().text().trim();

      // Extract manga's internal numeric ID from page (used for AJAX chapter list)
      let mangaId = "";
      const dataId = $("[data-id]").attr("data-id") || $("[data-manga-id]").attr("data-manga-id") || "";
      if (dataId) mangaId = dataId;
      else {
        const idMatch = html.match(/manga_id\s*[=:]\s*["']?(\d+)/);
        if (idMatch) mangaId = idMatch[1]!;
      }

      // Try to extract chapter count from page
      const totalChaptersText = $("[class*='total-chapter'], [class*='chapter-count']").first().text().trim();
      const totalChapters = parseInt(totalChaptersText.replace(/\D/g, "")) || 0;

      return { slug, mangaId, title, coverUrl, description, type, status, rating, genres, altTitles, author, artist, totalChapters };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire series failed");
    res.status(500).json({ error: "Failed to load series" });
  }
});

// ─── GET /api/mangafire/chapters/:mangaId ─────────────────────────────────────
router.get("/mangafire/chapters/:mangaId", async (req, res): Promise<void> => {
  const { mangaId } = req.params as { mangaId: string };
  const lang = String(req.query.lang ?? "en");
  const cacheKey = `mf:chapters:${mangaId}:${lang}`;

  try {
    const data = await withCache(cacheKey, 5 * 60_000, async () => {
      // Try AJAX endpoint first
      let chapters: Array<{ id: string; number: number; title: string; releaseDate: string | null }> = [];

      try {
        const json = await mfFetchJson<{ status: boolean; result: string }>(`/ajax/manga/${mangaId}/chapter/${lang}`);
        if (json.status && json.result) {
          const $ = cheerio.load(json.result);
          $("li, tr, [class*='chapter-item'], [class*='chapter'] a").each((_, el) => {
            const $el = $(el);
            const href = $el.find("a").attr("href") || $el.attr("href") || "";
            const idMatch = href.match(/\/(\d+)\/?(?:\?|#|$)/);
            const chId = idMatch ? idMatch[1]! : href.split("/").pop() ?? "";
            if (!chId) return;
            const numText = $el.find("[class*='name'], [class*='number']").text().trim() || $el.find("a").text().trim();
            const numMatch = numText.match(/[\d.]+/);
            const number = numMatch ? parseFloat(numMatch[0]) : 0;
            const dateText = $el.find("time, [class*='date'], [class*='time']").text().trim();
            chapters.push({ id: chId, number, title: numText || `Chapter ${number}`, releaseDate: dateText || null });
          });
        }
      } catch {
        // AJAX failed, chapters will be empty
      }

      return { chapters, total: chapters.length };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire chapters failed");
    res.json({ chapters: [], total: 0 });
  }
});

// ─── GET /api/mangafire/chapters-by-slug/:slug ────────────────────────────────
// First fetch series to get mangaId, then fetch chapters
router.get("/mangafire/chapters-by-slug/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const cacheKey = `mf:chapters-slug:${slug}`;

  try {
    const data = await withCache(cacheKey, 5 * 60_000, async () => {
      // Fetch the series page to find the manga ID
      const html = await mfFetch(`/manga/${slug}`);
      const $ = cheerio.load(html);

      let mangaId = "";
      const dataId = $("[data-id]").attr("data-id") || $("[data-manga-id]").attr("data-manga-id") || "";
      if (dataId) mangaId = dataId;
      else {
        const idMatch = html.match(/manga_id\s*[=:]\s*["']?(\d+)/i) ||
          html.match(/"manga_id"\s*:\s*(\d+)/) ||
          html.match(/data-id="(\d+)"/) ||
          html.match(/var\s+mangaId\s*=\s*(\d+)/);
        if (idMatch) mangaId = idMatch[1]!;
      }

      let chapters: Array<{ id: string; number: number; title: string; releaseDate: string | null }> = [];

      if (mangaId) {
        try {
          const json = await mfFetchJson<{ status: boolean; result: string }>(`/ajax/manga/${mangaId}/chapter/en`);
          if (json.status && json.result) {
            const $ch = cheerio.load(json.result);
            $ch("li, [class*='chapter-item']").each((_, el) => {
              const $el = $ch(el);
              const href = $el.find("a").attr("href") || "";
              const idMatch = href.match(/\/read\/[^/]+\/([^/?#]+)/);
              const chId = idMatch ? idMatch[1]! : href.split("/").pop() ?? "";
              if (!chId) return;
              const numText = $el.find("[class*='name']").text().trim() || $el.find("a").text().trim();
              const numMatch = numText.match(/[\d.]+/);
              const number = numMatch ? parseFloat(numMatch[0]) : 0;
              const dateText = $el.find("time, [class*='date']").text().trim();
              const title = numText || `Chapter ${number}`;
              chapters.push({ id: chId, number, title, releaseDate: dateText || null });
            });
          }
        } catch { /* ignore */ }
      }

      // Fallback: parse chapters from the series HTML page directly
      if (chapters.length === 0) {
        $("a[href*='/read/']").each((_, el) => {
          const href = $(el).attr("href") ?? "";
          const idMatch = href.match(/\/read\/[^/]+\/([^/?#]+)/);
          const chId = idMatch ? idMatch[1]! : "";
          if (!chId) return;
          const text = $(el).text().trim();
          const numMatch = text.match(/[\d.]+/);
          const number = numMatch ? parseFloat(numMatch[0]) : 0;
          const dateText = $(el).closest("li").find("time, .date").text().trim();
          chapters.push({ id: chId, number, title: text || `Chapter ${number}`, releaseDate: dateText || null });
        });
      }

      return { chapters, total: chapters.length, mangaId };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire chapters-by-slug failed");
    res.json({ chapters: [], total: 0 });
  }
});

// ─── GET /api/mangafire/read/:chapterId ───────────────────────────────────────
router.get("/mangafire/read/:chapterId", async (req, res): Promise<void> => {
  const { chapterId } = req.params as { chapterId: string };
  const slug = String(req.query.slug ?? "");
  const cacheKey = `mf:read:${chapterId}`;

  try {
    const data = await withCache(cacheKey, 30 * 60_000, async () => {
      let pages: string[] = [];

      // Try AJAX JSON endpoint
      try {
        const json = await mfFetchJson<{
          status: boolean;
          result: {
            images?: Array<[string, number, number]>;
            pages?: Array<{ url: string }>;
          };
        }>(`/ajax/read/${chapterId}/1`);

        if (json.status && json.result) {
          if (Array.isArray(json.result.images)) {
            pages = json.result.images.map(([url]) => url);
          } else if (Array.isArray(json.result.pages)) {
            pages = json.result.pages.map((p) => p.url);
          }
        }
      } catch { /* ignore, try HTML fallback */ }

      // Fallback: fetch HTML reader page
      if (pages.length === 0 && slug) {
        try {
          const html = await mfFetch(`/read/${slug}/${chapterId}`);
          const $ = cheerio.load(html);
          $(".reader img, [class*='reader'] img, #reader img, .pages img").each((_, el) => {
            const src = $(el).attr("src") || $(el).attr("data-src") || "";
            if (src && src.startsWith("http")) pages.push(src);
          });
          // Try to extract from page source JS
          if (pages.length === 0) {
            const urlMatches = html.matchAll(/"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g);
            for (const m of urlMatches) {
              const u = m[1];
              if (u && (u.includes("/manga/") || u.includes("/chapter/") || u.includes("/page/"))) {
                pages.push(u);
              }
            }
          }
        } catch { /* ignore */ }
      }

      return { pages, chapterId };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire read failed");
    res.json({ pages: [], chapterId });
  }
});

// ─── GET /api/mangafire/search ────────────────────────────────────────────────
router.get("/mangafire/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const sort = String(req.query.sort ?? "recently_updated");
  const status = String(req.query.status ?? "");
  const type = String(req.query.type ?? "");
  const genres = String(req.query.genres ?? "");
  const minChapters = parseInt(String(req.query.minChapters ?? "0"), 10);
  const cacheKey = `mf:search:${q}:${page}:${sort}:${status}:${type}:${genres}:${minChapters}`;

  const sortMap: Record<string, string> = {
    recently_updated: "recently_updated",
    popular: "trending",
    rating: "top_rated",
    "a-z": "a_z",
    newest: "new",
  };

  const statusMap: Record<string, string> = {
    ongoing: "1", completed: "2", hiatus: "3", dropped: "4",
  };

  const typeMap: Record<string, string> = {
    manga: "1", manhwa: "2", manhua: "3",
  };

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

      $(".unit, .manga-unit, [class*='manga-item']").each((_, el) => {
        const item = parseMangaCard($, el);
        if (!item) return;
        if (minChapters > 0) {
          const chNum = parseInt((item.latestChapter ?? "").replace(/\D/g, "")) || 0;
          if (chNum < minChapters) return;
        }
        items.push(item);
      });

      const lastPage = $(".page-item:last-child a, [class*='pagination'] li:last-child a").text().trim();
      const totalPages = parseInt(lastPage) || 1;

      return { items: items.slice(0, 20), page, hasMore: items.length >= 20, totalPages };
    });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "mangafire search failed");
    res.json({ items: [], page, hasMore: false, totalPages: 1 });
  }
});

export default router;
