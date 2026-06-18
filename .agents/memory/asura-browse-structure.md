---
name: AsuraScans browse page Astro island structure
description: The browse/search page uses a different Astro island key than the home page for series listings
---

## Rule
The AsuraScans `/browse?search=...` page has TWO Astro islands:
1. `navLinks` — navigation
2. `initialQuery`, `initialSeries`, `totalCount`, etc. — the search island

**Key difference**: Home/popular pages use `island.items`, but browse/search uses `island.initialSeries`.

**Cover field**: `initialSeries` items use `cover` (not `cover_url`) as the image field.

**Slug format**: `initialSeries` items have bare slugs like `nano-machine` without hash suffixes. The full hash-suffixed slug (`nano-machine-19cdf401`) must be extracted from HTML hrefs (`/comics/slug-hashid`) and matched by stripping the hash from the full slug.

**Why**: AsuraScans is built with Astro v5 where different page components serialize data differently.

**How to apply**: In `extractBrowseItems()`, check both `island.items ?? island.initialSeries`. Build a `fullSlugMap` from HTML hrefs first, then map bare slugs to full slugs when processing `initialSeries` items.
