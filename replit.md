# ShiroScans

A production-grade manga/manhwa/manhua reading platform styled after AsuraScans, with Deep Tropical Green (#036443) branding.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 + shadcn/ui + wouter routing + TanStack Query
- API: Express 5 (port 8080)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/shiroscans/` — React/Vite frontend
  - `src/pages/` — all page components (Home, Series, Reader, Popular, Latest, History, etc.)
  - `src/components/` — shared components (Navbar, Footer, MangaCard, Layout, SectionHeader)
  - `src/index.css` — Tailwind CSS v4 theme with brand color CSS variables
- `artifacts/api-server/` — Express API server
- `packages/db/` — Drizzle ORM schema (source of truth for DB structure)
- `packages/api-spec/` — OpenAPI spec (source of truth for API contracts)
- `packages/api-client-react/` — TanStack Query hooks (generated from spec)

## Architecture decisions

- **Multi-source**: Aggregates manga from MangaDex, Comick, WeebCentral, Raven Scans, and more — each with a distinct `provider` identifier.
- **Image proxy**: All external cover/chapter images routed through `/api/proxy-image?url=…` to avoid CORS issues. Some sources block proxying (400/403 expected).
- **Brand color**: Deep Tropical Green `#036443` = `hsl(160, 94%, 20%)` — defined as `--primary` in `index.css` for both `:root` and `.dark` modes.
- **Artifact ports**: shiroscans on 24239 (→ external 3000), api-server on 8080, mockup-sandbox on 8081 (→ external 80).
- **Vite proxy**: `/api` requests in the frontend dev server are proxied to `http://localhost:8080`.

## Product

- Home: Featured carousel + "Latest Updates" feed list + "Popular Now" ranked sidebar + "New Series" grid
- Series page: Cover, genres, description, chapter list with read/bookmark/favourite actions
- Reader: Full-page scroll with header nav (prev/next chapter) and chapter reactions
- Popular: Paginated grid with type tabs (All/Manga/Manhwa/Manhua/Webtoon) + filter sheet
- Latest Updates: Paginated grid with provider selector + filter sheet
- History: Date-grouped reading history (Today/Yesterday/This Week/This Month)
- Bookmarks/Favourites: Saved series lists
- Auth: Email/password registration and login
- Footer: Logo + links + Discord button

## User preferences

- Primary brand color: Deep Tropical Green `#036443` — apply to ALL primary accent elements
- Modeled after AsuraScans UX and layout

## Gotchas

- **Port 8080 conflicts**: If the artifact API server fails to start, check for stale node processes holding port 8080 and kill them (find PID via `/proc/net/tcp` inode lookup).
- **Comick Source API**: `services/comick-source-api` is a Next.js 14 app; binary is at `node_modules/next/dist/bin/next` (no `.bin` symlink). comix.to blocks Replit IPs — falls back to MangaDex for browse.
- **Workflow naming**: Only use artifact-managed workflows (`artifacts/api-server: API Server`, `artifacts/shiroscans: web`, `artifacts/mockup-sandbox: Component Preview Server`). Do NOT create manual workflows with the same ports.
- **Image 400 errors**: Normal — some external image hosts reject proxy requests.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
