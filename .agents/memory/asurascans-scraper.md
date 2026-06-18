---
name: AsuraScans scraper architecture
description: Key patterns for scraping asurascans.com (Astro v5 site) — paths, data formats, deserialization
---

## Site: asurascans.com (Astro v5.16.8)

**Why:** asurascans.com is NOT Next.js — no `__NEXT_DATA__`. It uses Astro v5.16.8 with data embedded in Astro island `props` attributes as HTML-encoded JSON with a `[type, value]` serialization format. The public API at `api.asurascans.com` returns 404 on all endpoints (requires auth).

## URL patterns
- Series page: `/comics/slug-hashid/` (e.g. `/comics/sword-gods-livestream-19cdf401/`)
- Chapter page: `/comics/slug-hashid/chapter/N` (numeric, e.g. `/chapter/1`, `/chapter/22`)
- Browse: `/browse?genres=action&status=ongoing&page=2`
- Cover images: `cdn.asurascans.com/asura-images/covers/slug.hash.webp`
- Chapter images: `cdn.asurascans.com/asura-images/chapters/slug/N/hash.webp?v=...`

## Astro island deserialization
Props attribute is HTML-encoded JSON with `[type, value]` tuples:
- `[0, scalar]` → the scalar value (pass through)
- `[0, {object}]` → deserialize each property value recursively
- `[1, [...tuples]]` → array, map each element through deserialization

Key function `deserializeAstro(val)`: if array, `[0, x]` → recurse on x; `[1, arr]` → map recurse.

## Home page data
Hero carousel Astro island has `items` prop: list of `{id, slug, title, cover_url, banner_url, description}`.
The `slug` in island data is WITHOUT the hash suffix (e.g. `"sword-gods-livestream"`).
The hrefs in HTML use `/comics/slug-hashid` WITH the hash (e.g. `"sword-gods-livestream-19cdf401"`).
Must map bare-slug → full-slug-with-hash by extracting hrefs from HTML separately.

## Series page data
Schema.org JSON-LD `<script type="application/ld+json">` with `@type: "ComicSeries"` contains:
- `name`, `description`, `image` (cover URL), `genre` (array), `numberOfEpisodes`

Chapter list: HTML hrefs `/comics/slug-hashid/chapter/N` — extract numeric N, dedupe, sort descending.

## Chapter page data
Astro island has: `seriesSlug`, `seriesId`, `seriesName`, `seriesCover`, `chapterId`, `chapterName`, `chapterNumber`, `chapterTitle`, `pages` (array of `{url}`), `prevChapter`, `nextChapter`, `chapterList`.
The `pages` array has all image URLs directly. `chapterList` has all chapters with `{id, number, slug}`.

## How to apply
Any change to the AsuraScans scraper must use `/comics/` paths, Astro island parsing, and Schema.org JSON-LD. Do NOT attempt to use `__NEXT_DATA__` or `api.asurascans.com` endpoints.
