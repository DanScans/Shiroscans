---
name: FlameComics chapter navigation
description: Chapter endpoint returns prev/next fields; FlameReader uses token params for navigation
---

FlameComics chapters require a `token` query parameter in the URL (`/flame/read/{seriesId}/{chapterId}?token={token}`). The token is different for each chapter. Without it, the chapter image CDN URLs cannot be constructed.

**Rule:** The `/api/flamecomics/chapters/{seriesId}/{chapterId}` endpoint resolves the token from the series data if not passed as a query param. It also returns `prevChapterId`, `prevToken`, `nextChapterId`, `nextToken` in the response for reader navigation.

**Why:** Without returning the token for adjacent chapters, the reader cannot construct correct navigation links.

**How to apply:** In `FlameReader.tsx`, use `chapterLink(id, token)` helper to construct nav URLs with the token. The `ChapterData` interface includes `prevChapterId`, `prevToken`, `nextChapterId`, `nextToken`.
