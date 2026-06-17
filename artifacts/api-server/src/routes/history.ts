import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, historyTable } from "@workspace/db";
import { AddHistoryBody, GetHistoryResponse, DeleteHistoryEntryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import "../lib/session";

const router: IRouter = Router();

router.get("/history", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const history = await db
    .select()
    .from(historyTable)
    .where(eq(historyTable.userId, userId))
    .orderBy(historyTable.readAt);

  res.json(
    GetHistoryResponse.parse(
      history.map((h) => ({
        ...h,
        readAt: h.readAt.toISOString(),
      })),
    ),
  );
});

router.post("/history", requireAuth, async (req, res): Promise<void> => {
  const parsed = AddHistoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;

  const [entry] = await db
    .insert(historyTable)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({
      target: [historyTable.userId, historyTable.provider, historyTable.seriesId],
      set: {
        chapterId: parsed.data.chapterId,
        chapterNumber: parsed.data.chapterNumber,
        readAt: new Date(),
      },
    })
    .returning();

  res.status(201).json({ ...entry, readAt: entry.readAt.toISOString() });
});

router.delete("/history/all", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  await db.delete(historyTable).where(eq(historyTable.userId, userId));
  res.json({ message: "History cleared" });
});

router.delete("/history/:provider/:seriesId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteHistoryEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.session.userId!;

  await db
    .delete(historyTable)
    .where(
      and(
        eq(historyTable.userId, userId),
        eq(historyTable.provider, params.data.provider),
        eq(historyTable.seriesId, params.data.seriesId),
      ),
    );

  res.json({ message: "History entry deleted" });
});

export default router;
