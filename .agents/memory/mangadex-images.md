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
