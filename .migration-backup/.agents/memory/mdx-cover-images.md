---
name: MangaDex cover images
description: Why MangaDex covers can't be server-proxied and how to display them correctly
---

## Rule
Never proxy `uploads.mangadex.org` cover images through the server-side `/api/proxy-image` endpoint. Load them directly in the browser instead.

**Why:** MangaDex's CDN (`uploads.mangadex.org`) blocks all datacenter/cloud server IPs with HTTP 400 (`content-type: text/html`) regardless of Referer or User-Agent headers. Server-side proxying is impossible. Additionally, when browsers load these images cross-origin, they send a Referer header (e.g. `https://shiroscans.replit.app/`) which triggers MangaDex's hotlink protection, showing a "You can read this at MangaDex" placeholder image instead of the real cover.

**How to apply:**
1. In every `proxyImage()` function: add `if (url.includes("uploads.mangadex.org")) return url;` before the proxy redirect line
2. Add `<meta name="referrer" content="no-referrer">` to `index.html` — this suppresses the Referer header for all cross-origin img requests, bypassing hotlink protection globally
3. MangaDex at-home chapter page CDNs (`*.mangadex.network`) are different — those DO work through the proxy (residential-like CDN nodes)
