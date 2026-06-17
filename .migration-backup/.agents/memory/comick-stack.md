---
name: ShiroScans Comick Stack
description: New multi-source architecture using Comick Source API (GooglyBlox) + MangaDex after the overhaul
---

## Stack

- **Primary source**: Comick Source API deployed at `https://comick-source-api.notaspider.dev` (no local install needed)
- **Metadata/Chapter CDN**: MangaDex API at `https://api.mangadex.org` (kept for chapter image serving)
- **60+ sources** available via `/api/manga/sources` — actual source IDs differ from display names (e.g. `comix` not `comick`, `asurascan` not `asura`, `flamecomics` not `flamescans`)

## Key routing rule

Provider value in URL `/manga/series/{provider}/{id}`:
- `mangadex` → MangaDex API (direct)
- Anything else → Comick Source API via `getSourceFromProvider()` mapper

## Comick Source API endpoints used

- `POST /api/search` — `{ query, source }` where source can be `"all"` or a specific source ID
- `POST /api/frontpage` — `{ source, section, page, limit, days? }` — sections: `trending`, `most_followed`, `latest_hot`, `latest_new`, `recently_added`, `completed`
- `POST /api/chapters` — `{ id, source, chapterId? }` — returns chapters + metadata
- `GET /api/sources` — full source list with real IDs

## Composite IDs

Non-MangaDex items use composite IDs in the format `source::rawId` (e.g. `comix::solo-leveling`). The server decodes these in series/chapter routes.

**Why:** Keeps provider and source-specific ID together in one URL param without changing the URL schema.
