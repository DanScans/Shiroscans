---
name: WeebCentral scraper
description: Working endpoints, HTML structure, and cover URL pattern for WeebCentral manga source
---

## Working approach

WeebCentral uses Cloudflare JS challenge on full page loads but HTMX endpoints work with `HX-Request: true` header.

### Key endpoints

| Endpoint | Method | Works? | Notes |
|---|---|---|---|
| `GET /` | GET + `HX-Request: true` | ✅ | Returns full HTML with series links directly |
| `GET /search?text=q&sort=...` | GET + `HX-Request: true` | ✅ | Returns page HTML, but results section is empty (lazy via `/search/data`) |
| `POST /search/simple?location=main` | POST + form `text=query` | ✅ | Returns quick search dropdown HTML with series cards |
| `GET /search/data?text=q&sort=...` | GET | ❌ | Always 307 → /400, avoid |
| `GET /series/{id}/full-chapter-list` | GET + `HX-Request: true` + `HX-Target: chapter-list` | ✅ | Chapter list HTML |
| `GET /chapters/{id}/images?is_prev=False&current_page=1` | GET + `HX-Request: true` | ✅ | Chapter image HTML (may have Cloudflare-protected images) |

### Series URL and ID format

- Series URLs: `https://weebcentral.com/series/{ULID}/{Title-Slug}`  
- ULID format: uppercase alphanumeric, e.g. `01J76XYEZYBE7Y3MEY7AEQ8MQN`
- The slug portion after the ULID is the title with hyphens

### Cover URL pattern

Covers are on a CDN keyed by the ULID — can be reconstructed without fetching anything:
- WebP small: `https://temp.compsci88.com/cover/small/{ULID}.webp`
- JPEG fallback: `https://temp.compsci88.com/cover/fallback/{ULID}.jpg`

This means for any series link found on a page, the cover can be constructed directly from the ULID.

### Homepage parsing

The WeebCentral homepage returns series links in two patterns:
1. Featured/carousel: `<a href="https://weebcentral.com/series/ULID/slug" preload>` (without aspect-square class)
2. Latest updates: `<a class="aspect-square overflow-hidden" href="..." preload>` (with aspect-square)

### Simple search HTML structure

```html
<a href="https://weebcentral.com/series/ULID/slug" class="btn join-item h-20">
  <picture>
    <source srcset="https://temp.compsci88.com/cover/small/ULID.webp">
    <img src="https://temp.compsci88.com/cover/fallback/ULID.jpg" alt="Title cover">
  </picture>
  <div>Title</div>
</a>
```

Extract title from `img.alt` (strip " cover" suffix) — more accurate than slug.

### Chapter list parsing pitfall

The chapter list HTML contains "Last Read" badge text and ISO timestamps that get picked up by `.text()`. Strip them:
- Remove elements with classes matching `badge`, `read`, `x-show`, `x-if`
- Regex strip: `/Last Read/gi` and `/\d{4}-\d{2}-\d{2}T[\d:.Z]+/g`
- Get only the first non-empty child's text
- Match chapter numbers via `/(?:episode|chapter|ch)[\s.]*(\d+(?:\.\d+)?)/i`

### Required headers for all requests

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
HX-Request: true
Referer: https://weebcentral.com/
```

**Why:** Without `HX-Request: true`, most endpoints return Cloudflare JS challenge. The `Referer` header helps bypass additional checks on some endpoints.
