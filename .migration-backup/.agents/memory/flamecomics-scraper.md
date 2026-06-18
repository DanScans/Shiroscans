---
name: FlameComics Scraper
description: How FlameComics Next.js data routes work and gotchas
---

FlameComics uses Next.js /_next/data/{buildId}/ routes for JSON data.

**Rule:** Always fetch homepage first to extract buildId from <script id="__NEXT_DATA__">. Cache 15min. On 404 from a data route, force-refresh buildId and retry once.

**Why:** The buildId changes on every deployment. Hardcoding it breaks within hours.

**How to apply:** getBuildId(force=false) in flamecomics.ts handles this. Pass force=true to bypass cache.

Key paths: home=index.json, series=series/{id}.json?id={id}, chapter=series/{sid}/{token}.json, browse=browse.json?search={q}
CDN: cdn.flamecomics.xyz/uploads/images/series/{seriesId}/{cover}
Chapter images: cdn.flamecomics.xyz/uploads/images/series/{seriesId}/{token}/{name}
