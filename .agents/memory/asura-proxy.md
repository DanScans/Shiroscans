---
name: AsuraScans image proxy setup
description: How cover and chapter images are served through the proxy
---

## Rule
All AsuraScans images (covers and chapter pages) go through `/api/proxy-image?url=<encoded>`.

- **Cover CDN**: `cdn.asurascans.com/asura-images/covers/...`
- **Cover CDN alt**: `gg.asuracomic.net/storage/...`
- **Chapter CDN**: `cdn.asurascans.com/asura-images/chapters/...`
- **Restored chapters**: `cdn.asurascans.com/asura-images/chapters-restored/...`

**Why**: Direct image requests fail CORS/hotlink protection. All these CDN domains are in the proxy allowlist in `artifacts/api-server/src/routes/manga.ts`.

**How to apply**: Always wrap AsuraScans image URLs: `proxyImage(url)` which calls `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`.
