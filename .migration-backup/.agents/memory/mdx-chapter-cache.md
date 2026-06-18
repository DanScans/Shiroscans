---
name: MangaDex chapter caching
description: How to make MangaDex chapter page loading fast — 4 parallel calls + multi-level caching
---

The MangaDex chapter pages endpoint originally made 4 API calls sequentially (at-home server + chapter info → feed 500 chapters → series title). This took 8s+ per chapter load.

**Rule:** Make all 4 calls with `Promise.all`. Use sub-caches (`withCache`) for expensive repeated lookups (feed = 30min, title = 1h) and a full response cache on the entire chapter (2h — pages never change post-publication).

**Why:** The 500-chapter feed is the killer call. It's always the same data per series, but was being fetched on every chapter navigation. Sub-caching it means the 2nd chapter onwards is instant (127ms).

**How to apply:** In `artifacts/api-server/src/routes/manga.ts`, the chapter endpoint key is `mdx:chpages:{chapterId}` (2h), feed key is `mdx:feed:{seriesId}` (30min), title key is `mdx:title:{seriesId}` (1h).
