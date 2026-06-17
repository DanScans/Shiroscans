---
name: ShiroScans brand color and workflow gotchas
description: Primary color value, HSL conversion, and port 8080 conflict resolution pattern.
---

## Brand color
- `#036443` (Deep Tropical Green) = `hsl(160, 94%, 20%)`
- Set as `--primary` CSS variable in `artifacts/shiroscans/src/index.css` in both `:root` and `.dark` sections.
- Also applied to `--sidebar-primary`, `--ring`, `--chart-1`, `--sidebar-ring`.

**Why:** The user explicitly requested #036443 to replace all teal/cyan accent colors site-wide.

**How to apply:** Change the HSL values `163 77% 35%` → `160 94% 20%` in `index.css`. Tailwind utilities like `bg-primary`, `text-primary`, `border-primary` pick it up automatically.

## Port 8080 conflict resolution
When the `artifacts/api-server: API Server` workflow fails with EADDRINUSE on port 8080:
1. Find inode: `grep "1F90" /proc/net/tcp | awk '{print $10}'`
2. Find PID: scan `/proc/[0-9]*/fd` for `socket:[<inode>]`
3. Kill: `kill -9 <pid>`

**Why:** Manually-created workflows leave stale node processes when removed; the artifact workflow can't bind the port until those die.

## Artifact workflow names (do not create manual duplicates)
- `artifacts/api-server: API Server` — port 8080
- `artifacts/shiroscans: web` — port 24239 (→ external 3000)
- `artifacts/mockup-sandbox: Component Preview Server` — port 8081 (→ external 80)
