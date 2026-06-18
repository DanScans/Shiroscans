---
name: Atsumaru / atsu.moe manga provider
description: Key facts about the Atsumaru (atsu.moe) manga provider integration — Typesense API, WeebCentral chapters, image proxy, iframe fallback for chapter reading.
---

## Typesense search API
- Endpoint: `https://atsu.moe/collections/manga/documents/search` — no auth required
- Key fields: `id` (5-char Typesense ID used as slug), `title`, `posterMedium`, `status`, `type`, `synopsis`, `views`, `trending`, `mbRating`, `tags`, `authors`, `year`, `chapterCount`, `weebCentralId`, `otherNames`
- Status values in Typesense: `"complete"`, `"releasing"`, `"hiatus"` — need normalization to "Completed"/"Ongoing"/"Hiatus"
- Cover URLs: `https://atsu.moe` + `posterMedium` (e.g., `/static/posters/{id}-medium.webp`)
- `atsu.moe` and `temp.compsci88.com` must be in the `PROXY_ALLOWED_HOSTS` set in `manga.ts`

## WeebCentral chapter list
- Full chapter list endpoint: `GET /series/:wcId/full-chapter-list` with `HX-Request: true` header
- Returns HTMX HTML with all chapters — 701 for Naruto, works reliably
- Chapter ID format: ULID like `01J8Z7WTD4218AGY0TGYYXZWZ2`
- Chapter date extracted from `x-data` attribute: `checkNewChapter('2024-09-29T15:55:24.962309Z')`
- Chapter links: `<a href="https://weebcentral.com/chapters/:id">`
- Parser: `$("a[href*='/chapters/']")` on the full-chapter-list response HTML

## Chapter images (WeebCentral)
- Endpoint: `GET /chapters/:id/images?is_prev=False&current_page=1` with `HX-Request: true` header
- **Cloudflare-protected** — returns empty (no img tags) from server-side requests
- Strategy: Always return `embedUrl = https://weebcentral.com/chapters/:id` as fallback
- Frontend reader renders the embedUrl as a full-screen sandboxed iframe when `pages.length === 0`

## Frontend routing (manga section)
- `/series/:id` → MangaFireSeriesDetail (id = Typesense 5-char ID, used as slug)
- `/read/:chapterId` → MangaFireReader (chapterId = WeebCentral ULID)
- Reader URL includes `?slug=:atsuId&wcId=:weebCentralId` for back navigation and chapter list
- Provider string for bookmarks/reactions/ratings/comments: `"atsu"`

## Manhwa section (AsuraScans)
- `/manhwa` → ManhwaHome, `/manhwa/browse` → ManhwaBrowse, `/manhwa/series/:slug` → ManhwaSeriesDetail
- `/manhwa/read/:slug/:chapterNum` → ManhwaReader (outside Layout, full-screen)
- Provider string: `"asurascans"`
- Chapter navigation: slug + chapter number (not ULID)

**Why:** atsu.moe uses Typesense (fast, no auth), WeebCentral for chapter content — but WeebCentral chapter images are Cloudflare-protected so iframe embed is the only reliable reading method.
