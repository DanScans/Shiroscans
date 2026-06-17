import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, bookmarksTable } from "@workspace/db";
import { AddBookmarkBody, GetBookmarksResponse, RemoveBookmarkParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import "../lib/session";

const router: IRouter = Router();

router.get("/bookmarks", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const bookmarks = await db
    .select()
    .from(bookmarksTable)
    .where(eq(bookmarksTable.userId, userId))
    .orderBy(bookmarksTable.createdAt);

  res.json(
    GetBookmarksResponse.parse(
      bookmarks.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/bookmarks", requireAuth, async (req, res): Promise<void> => {
  const parsed = AddBookmarkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;

  const [bookmark] = await db
    .insert(bookmarksTable)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({
      target: [bookmarksTable.userId, bookmarksTable.provider, bookmarksTable.seriesId],
      set: { title: parsed.data.title, coverImage: parsed.data.coverImage },
    })
    .returning();

  res.status(201).json({ ...bookmark, createdAt: bookmark.createdAt.toISOString() });
});

router.delete("/bookmarks/:provider/:seriesId", requireAuth, async (req, res): Promise<void> => {
  const params = RemoveBookmarkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.session.userId!;

  await db
    .delete(bookmarksTable)
    .where(
      and(
        eq(bookmarksTable.userId, userId),
        eq(bookmarksTable.provider, params.data.provider),
        eq(bookmarksTable.seriesId, params.data.seriesId),
      ),
    );

  res.json({ message: "Bookmark removed" });
});

export default router;
