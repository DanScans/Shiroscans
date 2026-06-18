---
name: MangaFire scraper
description: Working selectors, proxy allowlist, reader strategy, and known Cloudflare blocks for MangaFire.to integration
---

## Card parsing (parseMangaCard)
- Card slug: `a.poster[href="/manga/{slug}"]` → strip `/manga/` prefix
- Cover: `a.poster img[src]` or `img[data-src]`
- Title: `.info a[href*='/manga/']` text, fallback `img[alt]` — wrap `?? ""` fallback in parentheses: `($el.find("img").first().attr("alt") ?? "")`
- Type badge: `.type` text → "Manga" | "Manhwa" | "Manhua"
- Latest chapter: `ul.content[data-name='chap'] li a span` or `a[href*='/read/']` text
- Numeric ID: class `unit item-{numericId}` → extract last part

## Series detail page selectors
- Title: `h1[itemprop="name"]`
- Cover: `div.poster img`
- Status: `.info > p` first → "Releasing" = Ongoing, "Completed", "Hiatus"
- Rating: `[data-score]` attribute value
- **Genres: `.meta a[href*='/genre/']`** — MUST scope to `.meta`, not bare `a[href*='/genre/']` which picks up all 41 nav genres
- Type: `.min-info a[href*='/type/']`
- Author: `[itemprop='author']` or `a[href*='/author/']`
- Manga ID: regex `/"manga_id"\s*:\s*(\d+)/` in raw HTML

## Chapters endpoint
- Use `/ajax/manga/{mangaId}/chapter` with `X-Requested-With: XMLHttpRequest` — returns JSON with chapters array
- Chapter ID format for reader: `{slug}/en/chapter-{N}` (e.g. `blue-lockk.kw9j9/en/chapter-350`)
- Chapters-by-slug endpoint scrapes `/manga/{slug}` HTML for read links

## Reader strategy
- `/ajax/read/{chapterId}` returns Cloudflare 403 — permanently blocked server-side
- Strategy: try scraping `/read/{chapterId}` page for `img[data-src]` then `img[src]` with mfcdn.nl pattern (exclude `/assets/` URLs which are site logos)
- Always return `embedUrl: "https://mangafire.to/read/{chapterId}"` as fallback
- Frontend shows iframe when `pages.length === 0` and `embedUrl` is set

## Image proxy (proxy-image endpoint in manga.ts)
- Add `mfcdn.nl` wildcard to isAllowedProxyHost: `h === "mfcdn.nl" || h.endsWith(".mfcdn.nl")`
- MangaFire CDN referer header: `"https://mangafire.to/"`
- Also add static entries: `"mfcdn.nl"`, `"s.mfcdn.nl"`, `"static.mfcdn.nl"`, `"img.mfcdn.nl"` to PROXY_ALLOWED_HOSTS

## Route parameter for chapterId with slashes
- Frontend encodes chapter ID with `encodeURIComponent` (slashes → `%2F`)
- Backend route: `/mangafire/read/:chapterId` (no wildcard suffix needed)
- In handler: `decodeURIComponent(req.params.chapterId)` to restore slashes
- Express does NOT decode `%2F` in route matching — it stays as one path segment

## Search — permanently blocked
- `/filter?keyword={q}` returns Cloudflare 403 from Replit server IPs
- `/filter?sort=recently_updated` (without keyword) works fine
- `/ajax/suggest?keyword={q}` returns 404 — no suggest API
- `/search?keyword={q}` returns 404
- Accept search as non-functional; Browse page with sort/type/genre filters still works

## Provider names for reactions/ratings/comments
- Use `"mangafire"` not `"asurascans"` as provider in all API calls from MangaFireSeriesDetail.tsx

**Why:** These are lessons from building the MangaFire integration; they are not derivable from the current code comments alone.
