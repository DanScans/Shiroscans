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

const TYPESENSE_BASE = "https://atsu.moe";
const WEEB_BASE = "https://weebcentral.com";

const WEEB_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": `${WEEB_BASE}/`,
};

const TTL_HOME = 5 * 60 * 1000;
const TTL_BROWSE = 3 * 60 * 1000;
const TTL_SERIES = 15 * 60 * 1000;
const TTL_CHAPTERS = 10 * 60 * 1000;
const TTL_IMAGES = 8 * 60 * 1000;

interface TypesenseDoc {
  id: string;
  title: string;
  poster: string;
  posterMedium?: string;
  posterSmall?: string;
  status?: string;
  type?: string;
  synopsis?: string;
  views?: number;
  trending?: number;
  mbRating?: number;
  tags?: string[];
  authors?: string[];
  year?: number;
  chapterCount?: number;
  weebCentralId?: string;
  otherNames?: string[];
  isAdult?: boolean;
  releaseYear?: number;
}

interface TypesenseResult {
  hits: Array<{ document: TypesenseDoc }>;
  found?: number;
}

function coverUrl(doc: TypesenseDoc): string {
  const path = doc.posterMedium ?? doc.posterSmall ?? doc.poster ?? "";
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${TYPESENSE_BASE}${path}`;
}

function normalizeStatus(s?: string): string {
  if (!s) return "Ongoing";
  const l = s.toLowerCase();
  if (l === "complete" || l === "completed" || l.includes("finish")) return "Completed";
  if (l.includes("hiatus") || l.includes("on hold")) return "Hiatus";
  if (l.includes("drop") || l.includes("cancel")) return "Dropped";
  return "Ongoing";
}

function docToSeries(doc: TypesenseDoc) {
  return {
    id: doc.id,
    slug: doc.id,
    title: doc.title,
    coverUrl: coverUrl(doc),
    type: doc.type ?? "Manga",
    status: normalizeStatus(doc.status),
    rating: doc.mbRating ?? null,
    genres: doc.tags ?? [],
    authors: doc.authors ?? [],
    description: doc.synopsis ?? "",
    year: doc.year ?? doc.releaseYear ?? null,
    totalChapters: doc.chapterCount ?? 0,
    weebCentralId: doc.weebCentralId ?? null,
    altTitles: doc.otherNames ?? [],
    latestChapter: doc.chapterCount ? `Ch. ${doc.chapterCount}` : null,
  };
}

const TYPESENSE_INCLUDE = "id,title,poster,posterMedium,posterSmall,status,type,synopsis,views,trending,mbRating,tags,authors,year,chapterCount,weebCentralId,otherNames";

async function tsSearch(params: URLSearchParams): Promise<TypesenseResult> {
  const url = `${TYPESENSE_BASE}/collections/manga/documents/search?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Typesense ${res.status}`);
  return res.json() as Promise<TypesenseResult>;
}

// ── GET /atsu/home ────────────────────────────────────────────────────────────
router.get("/atsu/home", async (_req, res): Promise<void> => {
  try {
    const [featured, latest] = await Promise.all([
      withCache("atsu:home:featured", TTL_HOME, async () => {
        const p = new URLSearchParams({
          q: "*", query_by: "title",
          filter_by: "hidden:!=true && trending:>0",
          sort_by: "trending:desc", per_page: "30", include_fields: TYPESENSE_INCLUDE,
        });
        const r = await tsSearch(p);
        return r.hits.map((h) => docToSeries(h.document));
      }),
      withCache("atsu:home:latest", TTL_HOME, async () => {
        const p = new URLSearchParams({
          q: "*", query_by: "title",
          filter_by: "hidden:!=true",
          sort_by: "dateAdded:desc", per_page: "20", include_fields: TYPESENSE_INCLUDE,
        });
        const r = await tsSearch(p);
        return r.hits.map((h) => docToSeries(h.document));
      }),
    ]);
    res.json({ featured, latest });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /atsu/trending ────────────────────────────────────────────────────────
router.get("/atsu/trending", async (_req, res): Promise<void> => {
  try {
    const items = await withCache("atsu:trending", TTL_HOME, async () => {
      const p = new URLSearchParams({
        q: "*", query_by: "title",
        filter_by: "hidden:!=true && trending:>0",
        sort_by: "trending:desc", per_page: "20", include_fields: TYPESENSE_INCLUDE,
      });
      const r = await tsSearch(p);
      return r.hits.map((h) => docToSeries(h.document));
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /atsu/popular?period=weekly|monthly|alltime ───────────────────────────
router.get("/atsu/popular", async (req, res): Promise<void> => {
  try {
    const period = String(req.query.period ?? "alltime");
    const items = await withCache(`atsu:popular:${period}`, TTL_HOME, async () => {
      const p = new URLSearchParams({
        q: "*", query_by: "title",
        filter_by: "hidden:!=true",
        sort_by: period === "alltime" ? "views:desc" : "trending:desc",
        per_page: "20", include_fields: TYPESENSE_INCLUDE,
      });
      const r = await tsSearch(p);
      return r.hits.map((h) => docToSeries(h.document));
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /atsu/latest?page=1 ───────────────────────────────────────────────────
router.get("/atsu/latest", async (req, res): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const data = await withCache(`atsu:latest:${page}`, TTL_BROWSE, async () => {
      const p = new URLSearchParams({
        q: "*", query_by: "title",
        filter_by: "hidden:!=true",
        sort_by: "dateAdded:desc",
        per_page: "20", page: String(page), include_fields: TYPESENSE_INCLUDE,
      });
      const r = await tsSearch(p);
      const total = r.found ?? 0;
      return {
        items: r.hits.map((h) => docToSeries(h.document)),
        totalPages: Math.min(Math.ceil(total / 20) || 10, 50),
      };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /atsu/search?q=&page=&type=&status=&sort= ─────────────────────────────
router.get("/atsu/search", async (req, res): Promise<void> => {
  try {
    const q = String(req.query.q ?? "").trim() || "*";
    const page = Math.max(1, Number(req.query.page ?? 1));
    const typeFilter = String(req.query.type ?? "").trim();
    const statusFilter = String(req.query.status ?? "").trim();
    const sort = String(req.query.sort ?? "").trim();

    const cacheKey = `atsu:search:${q}:${page}:${typeFilter}:${statusFilter}:${sort}`;
    const data = await withCache(cacheKey, TTL_BROWSE, async () => {
      const filters = ["hidden:!=true"];
      if (typeFilter && typeFilter !== "All") {
        const t = typeFilter === "Manhwa" ? "Manhwa" : typeFilter === "Manhua" ? "Manhua" : "Manga";
        filters.push(`type:=${t}`);
      }
      if (statusFilter && statusFilter !== "All") {
        const ns = normalizeStatus(statusFilter);
        const tsStatus = ns === "Completed" ? "complete" : ns === "Hiatus" ? "hiatus" : "releasing";
        filters.push(`status:=${tsStatus}`);
      }

      let sortBy = q === "*" ? "views:desc" : "_text_match:desc,views:desc";
      if (sort === "rating") sortBy = "mbRating:desc";
      else if (sort === "newest") sortBy = "dateAdded:desc";
      else if (sort === "trending") sortBy = "trending:desc";
      else if (sort === "a-z") sortBy = "title:asc";

      const p = new URLSearchParams({
        q, query_by: "title,otherNames",
        filter_by: filters.join(" && "),
        sort_by: sortBy,
        per_page: "24", page: String(page), include_fields: TYPESENSE_INCLUDE,
      });
      const r = await tsSearch(p);
      const total = r.found ?? 0;
      return {
        items: r.hits.map((h) => docToSeries(h.document)),
        totalPages: Math.min(Math.ceil(total / 24) || 1, 50),
        total,
      };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /atsu/series/:id ──────────────────────────────────────────────────────
router.get("/atsu/series/:id", async (req, res): Promise<void> => {
  try {
    const id = req.params.id;
    const data = await withCache(`atsu:series:${id}`, TTL_SERIES, async () => {
      const p = new URLSearchParams({
        q: id, query_by: "id",
        filter_by: `id:=${id}`,
        per_page: "1", include_fields: TYPESENSE_INCLUDE,
      });
      const r = await tsSearch(p);
      if (!r.hits.length) throw new Error("Not found");
      return docToSeries(r.hits[0].document);
    });
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

// ── GET /atsu/chapters/:weebCentralId — chapter list via WeebCentral ──────────
router.get("/atsu/chapters/:wcId", async (req, res): Promise<void> => {
  try {
    const wcId = req.params.wcId;
    const data = await withCache(`atsu:chapters:${wcId}`, TTL_CHAPTERS, async () => {
      // Use the full-chapter-list HTMX endpoint which returns all chapters
      const url = `${WEEB_BASE}/series/${wcId}/full-chapter-list`;
      const response = await fetch(url, {
        headers: { ...WEEB_HEADERS, "HX-Request": "true", "Accept": "text/html" },
        signal: AbortSignal.timeout(20000),
      });
      // Fallback to main series page if full list not available
      const html = response.ok ? await response.text()
        : await (await fetch(`${WEEB_BASE}/series/${wcId}`, {
            headers: WEEB_HEADERS, signal: AbortSignal.timeout(20000),
          })).text();

      const $ = cheerio.load(html);
      const chapters: Array<{ id: string; number: number; title: string; releaseDate: string | null }> = [];

      // Chapter links: href="/chapters/ULID" or "https://weebcentral.com/chapters/ULID"
      const seen = new Set<string>();
      $("a[href*='/chapters/']").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        const chapterId = href.match(/\/chapters\/([A-Z0-9]+)/i)?.[1];
        if (!chapterId || seen.has(chapterId)) return;
        seen.add(chapterId);

        // Chapter text (skip SVG content)
        const text = $(el).clone().find("svg, span.me-2").remove().end().text().trim();
        const numMatch = text.match(/Chapter\s+([\d.]+)/i);
        const num = numMatch ? parseFloat(numMatch[1]) : 0;

        // Date from parent x-data attribute
        const xData = $(el).closest("[x-data]").attr("x-data") ?? "";
        const dateMatch = xData.match(/checkNewChapter\('([^']+)'\)/);
        const releaseDate = dateMatch ? dateMatch[1] : null;

        chapters.push({
          id: chapterId,
          number: num,
          title: text.replace(/Chapter\s+[\d.]+\s*[-–—]?\s*/i, "").trim() || `Chapter ${num}`,
          releaseDate,
        });
      });

      chapters.sort((a, b) => b.number - a.number);
      return { chapters };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── GET /atsu/read/:chapterId — chapter images via WeebCentral ────────────────
router.get("/atsu/read/:chapterId", async (req, res): Promise<void> => {
  try {
    const chapterId = req.params.chapterId;
    const data = await withCache(`atsu:read:${chapterId}`, TTL_IMAGES, async () => {
      const url = `${WEEB_BASE}/chapters/${chapterId}/images?is_prev=False&current_page=1`;
      const response = await fetch(url, {
        headers: {
          ...WEEB_HEADERS,
          "HX-Request": "true",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(20000),
      });

      const pages: string[] = [];
      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        $("img[src]").each((_, el) => {
          const src = $(el).attr("src") ?? "";
          if (src && src.startsWith("http") && !src.includes("/static/") && !src.includes("brand")) {
            pages.push(src);
          }
        });
        $("img[data-src]").each((_, el) => {
          const src = $(el).attr("data-src") ?? "";
          if (src && src.startsWith("http") && !pages.includes(src)) pages.push(src);
        });
      }

      const embedUrl = pages.length === 0 ? `${WEEB_BASE}/chapters/${chapterId}` : "";
      return { pages, chapterId, embedUrl };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
