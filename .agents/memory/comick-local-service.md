---
name: comick-local-service
description: Running the local comick-source-api (GooglyBlox) clone as a microservice; startup quirks and what sources actually work from Replit.
---

## Service Setup
- Clone at: `services/comick-source-api/`
- Command: `cd services/comick-source-api && node ./node_modules/next/dist/bin/next dev -p 3001`
- Workflow: `services/comick-source-api: Comick Source API (Local)` on port 3001
- **Critical**: npm installs `next@14.2.35` into `node_modules/next/` but does NOT create a `.bin/next` symlink. Use the direct path `node ./node_modules/next/dist/bin/next`.

## Workflow Config Gotcha
Next.js 14 dev server takes 4–5 seconds to be ready. Replit's `configureWorkflow` with `waitForPort: 3001` will TIME OUT and kill the process. Always configure with **no waitForPort** (`waitForPort: null`).

## What Works from Replit IPs
- **Search (NDJSON streaming)**: WeebCentral ✓, mgeko ✓, raven-scans ✓, mangapark ✓, asurascans ✗ (clientOnly), comix.to ✗ (404)
- **Frontpage**: Only `comix` is registered in `src/lib/frontpages/index.ts` — and comix.to returns 404/403 from Replit IPs
- **MangaDex fallback**: Always works; used when comick frontpage fails

## API Response Shapes (corrected)
- `POST /api/frontpage` → `{ source, sourceName, section: { id, title, type, items: FrontpageManga[], ... }, fetchedAt }` — items at `data.section.items` NOT `data.data` or `data.items`
- `POST /api/chapters` → `{ chapters: ScrapedChapter[], source: string, totalChapters: number }` — takes `{ url: mangaPageUrl, source: scraperDisplayName }` NOT `{ id, source }`
- `POST /api/search` → streaming NDJSON, each line: `{"results":[...SearchResult],"source":"SourceName"}` — NO `done` field (just parse all lines with `results` arrays)

## ID Scheme for Non-MangaDex
Use `mangaUrl` (the full source page URL) as the item ID. It's unique per source and can be passed directly to `/api/chapters` as the `url` param.

**Why:** The chapters endpoint requires the manga page URL, not a hash ID. Storing the URL as the ID avoids any reconstruction logic.

## Source Name Mapping
The `source` param in `/api/chapters` must be the scraper's `getName()` value (display name), e.g. "Comix" not "comix", "WeebCentral" not "weebcentral". See `getScraperNameFromSource()` in manga.ts.
