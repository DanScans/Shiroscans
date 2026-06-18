---
name: MangaDex CDN proxy allowlist
description: MangaDex at-home CDN hostnames are dynamic — hardcoded Set fails for most chapters
---

The MangaDex at-home server (`/at-home/server/{chapterId}`) returns a `baseUrl` pointing to a CDN node. These hostnames vary per request (e.g., `s2.mangadex.org`, `cmdxd98sb0x3yprd.mangadex.network`, `s5.mangadex.org`).

**Rule:** Never rely on a hardcoded list of MangaDex CDN hostnames. Use wildcard matching:
```typescript
function isAllowedProxyHost(h: string): boolean {
  if (PROXY_ALLOWED_HOSTS.has(h)) return true;
  if (h === "mangadex.org" || h.endsWith(".mangadex.org")) return true;
  if (h.endsWith(".mangadex.network")) return true;
  return false;
}
```

**Why:** Only `cmdxd98sb0x3yprd.mangadex.network` was in the static allowlist. Any other CDN node returned 403 from our proxy, causing blank chapter pages.

**How to apply:** In `artifacts/api-server/src/routes/manga.ts`, the proxy route uses `isAllowedProxyHost()` instead of `PROXY_ALLOWED_HOSTS.has()`.
