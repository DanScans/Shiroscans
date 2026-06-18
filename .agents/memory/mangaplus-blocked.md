---
name: MangaPlus API blocked from Replit
description: MangaPlus protobuf API returns account-banned FailureResult from Replit server IPs; MangaDex is the viable replacement
---

MangaPlus API (`jumpg-webapi.tokyo-cdn.com/api/`) returns HTTP 200 but the protobuf body's first field is field 2 (FailureResult) with subject "Account Banned" when called from Replit server IPs. No header/param combination (os=1, device_token, etc.) bypasses this block.

**Why:** MangaPlus blocks cloud provider IP ranges server-side.

**How to apply:** Use MangaDex (`api.mangadex.org`) for the /manga section instead. MangaDex has a free JSON REST API with no auth required for browsing. Routes are in `artifacts/api-server/src/routes/mangadex.ts`.
