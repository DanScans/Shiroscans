# ShiroScans

A manga/manhwa/manhua reader web app with multiple source aggregation, user accounts, bookmarks, history, favourites, and chapter reactions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/shiroscans run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + wouter (routing) + TanStack Query
- API: Express 5 + session auth (bcrypt passwords)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/shiroscans/` — React + Vite frontend
- `artifacts/api-server/` — Express backend (auth, manga proxy, bookmarks, history, favourites, reactions, profile)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod schemas (used server-side)
- `lib/db/src/schema/` — Drizzle ORM schema (users, bookmarks, history, favourites, reactions)
- `attached_assets/` — Logo and other image assets

## Architecture decisions

- Manga content is fetched via a proxy through the Express API server — the frontend never calls external manga APIs directly, avoiding CORS issues.
- Comick Source API (local-first at port 3001, remote fallback) and MangaDex API provide content.
- Session-based auth with bcrypt password hashing.
- Image proxy endpoint at `/api/proxy-image` handles CORS/referer-restricted cover images.
- App starts in dark mode by default (`document.documentElement.classList.add("dark")`).

## Product

- Browse manga/manhwa/manhua from multiple sources (MangaDex, Comick, AsuraScans, WeebCentral, etc.)
- Search across sources with streaming NDJSON results
- Read chapters with prev/next navigation
- User accounts: register, login, profile management
- Bookmarks, reading history, favourites, per-chapter emoji reactions
- Dark mode UI throughout

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `bcrypt` requires native build approval in pnpm-workspace.yaml `onlyBuiltDependencies`
- Vite `fs.strict: true` requires the artifact root AND `attached_assets/` in `server.fs.allow`
- The `mangadex-full-api` package is listed as a dependency but the server uses raw `fetch` against the MangaDex REST API directly

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
