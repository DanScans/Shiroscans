---
name: MangaDex image loading strategy
description: Cover images must load directly from CDN in browser; chapter pages can be proxied via backend
---

MangaDex CDN (`uploads.mangadex.org`) returns HTTP 400 for server-side proxy requests regardless of headers. Browser direct requests work fine (CDN has browser CORS support).

**Cover URL format:** `https://uploads.mangadex.org/covers/{manga.id}/{fileName}` where `fileName` from the API already includes `.jpg` extension. For thumbnails: `{fileName}.256.jpg` or `{fileName}.512.jpg`.

**Why:** CDN blocks non-browser User-Agents or cloud provider IPs for cost control.

**How to apply:**
- Cover images: use direct URL in `<img>` tag (no proxy)
- Chapter pages (from at-home server): proxy through `/api/mangadex/proxy-image` since they're served from user-chosen servers that may be unreachable from browser for CORS reasons

**Feed endpoint quirk (chapter= filter causes 400):**
- `/manga/{id}/feed?chapter=1` → HTTP 400 — do NOT use the `chapter=` filter.
- Instead, build the URL as a raw string (not via URLSearchParams) using `offset` to jump near the target chapter, then match locally. e.g. `offset=Math.max(0, chapterNum - 5)`, fetch 40 chapters, pick closest by number.
- Raw string required because URLSearchParams encodes `translatedLanguage[]` → `translatedLanguage%5B%5D` which, when combined with certain params, triggers 400. Literal brackets in a raw string work fine.
- `/api/mangadex/chapter-images?title=&chapter=` implements this pattern as a download fallback for WeebCentral (Cloudflare-protected) chapters.
