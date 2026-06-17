---
name: MangaDex API setup for ShiroScans
description: CoorenLabs DNS fails from Replit; MangaDex is the working replacement. Array param double-bracket bug.
---

## Rule
Use MangaDex (`https://api.mangadex.org`) as the manga data source — CoorenLabs (`api.coorenlabs.com`) cannot be DNS-resolved from Replit's sandbox. AniList (`graphql.anilist.co`) also works if metadata-only is needed.

**Why:** `curl api.coorenlabs.com` returns "Could not resolve host" — it's simply unreachable from this environment.

## Array param pitfall
The `mdx()` helper builds query strings from a `params` object. Keys that already contain `[]` (e.g. `"includes[]"`, `"contentRating[]"`) must be appended as-is — do NOT add another `[]` suffix in the loop, or MangaDex gets `includes[][]` and ignores the param (returns empty results).

**How to apply:** In the `mdx()` function, for array values do `url.searchParams.append(k, item)` — not `append(k + "[]", item)`.

## Cover art URL format
`https://uploads.mangadex.org/covers/{mangaId}/{fileName}.512.jpg`

Cover `fileName` lives in the manga's `relationships` array: find `type === "cover_art"` then `rel.attributes.fileName`.
Always pass `"includes[]": ["cover_art"]` to `/manga` endpoints to get it in a single call.

## Credentials fix
`customFetch` in `lib/api-client-react/src/custom-fetch.ts` needs `credentials: "include"` on the fetch call for session cookies to work with the Express backend.

## Auth 401 handling
Configure QueryClient with a `retry` function that returns `false` for status 401/403/404 — prevents noisy console errors when user is not logged in.
