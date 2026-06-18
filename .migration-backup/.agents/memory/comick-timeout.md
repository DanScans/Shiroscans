---
name: Comick local timeout
description: Why the comickFetch local timeout must stay very short
---

The `comickFetch` function tries `localhost:3001` first before falling back to the remote Comick API.
There is no local Comick instance running in this project — port 3001 is always unresponsive.

**Why:** If the local timeout is 25s (the original default), every single API call that uses Comick
(home feed, popular, latest, search, chapter pages) silently waits 25 seconds before using the remote.
This makes every page load take 25+ seconds.

**How to apply:** Keep `localTimeout` in `comickFetch` at ≤1500ms. The fallback to
`COMICK_REMOTE` (https://comick-source-api.notaspider.dev) kicks in immediately on connection refused.
The remote timeout (`timeoutMs`) can be longer (8s default) since it's a real network call.

File: `artifacts/api-server/src/routes/manga.ts`, `comickFetch` function.
