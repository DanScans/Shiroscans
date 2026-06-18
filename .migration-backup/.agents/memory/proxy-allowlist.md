---
name: Proxy allowlist domains
description: Which domains need to be in PROXY_ALLOWED_HOSTS in manga.ts
---

**Rule:** Every CDN subdomain needs its own entry. flamecomics.xyz does NOT cover cdn.flamecomics.xyz.

**Why:** The Set check is on parsed.hostname (exact match), not suffix match.

**How to apply:** When adding a new source, add ALL subdomains that serve images as separate entries in PROXY_ALLOWED_HOSTS in artifacts/api-server/src/routes/manga.ts.
