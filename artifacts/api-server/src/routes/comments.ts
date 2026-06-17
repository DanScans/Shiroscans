import { Router, type IRouter } from "express";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { db, commentsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import "../lib/session";

const router: IRouter = Router();

// GET /api/comments/:provider/:seriesId/:chapterId
// Query: page, limit, sortBy (newest|oldest|best)
router.get("/comments/:provider/:seriesId/:chapterId", async (req, res): Promise<void> => {
  const { provider, seriesId, chapterId } = req.params;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const sortBy = String(req.query.sortBy ?? "newest");
  const offset = (page - 1) * limit;

  const orderBy = sortBy === "oldest"
    ? asc(commentsTable.createdAt)
    : desc(commentsTable.createdAt);

  const [{ total }] = await db
    .select({ total: count() })
    .from(commentsTable)
    .where(
      and(
        eq(commentsTable.provider, provider),
        eq(commentsTable.seriesId, seriesId),
        eq(commentsTable.chapterId, chapterId),
      ),
    );

  const rows = await db
    .select({
      id: commentsTable.id,
      content: commentsTable.content,
      createdAt: commentsTable.createdAt,
      userId: commentsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(
      and(
        eq(commentsTable.provider, provider),
        eq(commentsTable.seriesId, seriesId),
        eq(commentsTable.chapterId, chapterId),
      ),
    )
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  res.json({
    comments: rows,
    total: Number(total),
    page,
    hasMore: offset + rows.length < Number(total),
  });
});

// POST /api/comments — create a comment
// Body: { provider, seriesId, chapterId, content }
router.post("/comments", requireAuth, async (req, res): Promise<void> => {
  const { provider, seriesId, chapterId, content } = req.body as {
    provider?: string; seriesId?: string; chapterId?: string; content?: string;
  };

  if (!provider || !seriesId || !chapterId) {
    res.status(400).json({ error: "provider, seriesId, chapterId are required" });
    return;
  }

  const trimmed = (content ?? "").trim();
  if (!trimmed || trimmed.length > 2000) {
    res.status(400).json({ error: "content must be 1–2000 characters" });
    return;
  }

  const userId = req.session.userId!;

  const [inserted] = await db
    .insert(commentsTable)
    .values({ userId, provider, seriesId, chapterId, content: trimmed })
    .returning({ id: commentsTable.id, createdAt: commentsTable.createdAt });

  const [user] = await db
    .select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.status(201).json({
    id: inserted.id,
    content: trimmed,
    createdAt: inserted.createdAt,
    userId,
    username: user.username,
    avatarUrl: user.avatarUrl,
  });
});

// DELETE /api/comments/:id — delete own comment
router.delete("/comments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const userId = req.session.userId!;

  const [row] = await db
    .select({ userId: commentsTable.userId })
    .from(commentsTable)
    .where(eq(commentsTable.id, id));

  if (!row) { res.status(404).json({ error: "Comment not found" }); return; }
  if (row.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(commentsTable).where(eq(commentsTable.id, id));
  res.json({ success: true });
});

export default router;
