import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { db, reactionsTable } from "@workspace/db";
import { AddReactionBody, AddReactionParams, GetReactionsParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import "../lib/session";

const router: IRouter = Router();

const VALID_REACTIONS = ["love", "fire", "wow", "sad", "angry"] as const;

function buildSummary(rows: { reaction: string; count: number }[], userReaction: string | null) {
  const counts: Record<string, number> = { love: 0, fire: 0, wow: 0, sad: 0, angry: 0 };
  rows.forEach((r) => { if (r.reaction in counts) counts[r.reaction] = r.count; });
  return { ...counts, userReaction };
}

router.get("/reactions/:provider/:seriesId/:chapterId", async (req, res): Promise<void> => {
  const params = GetReactionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { provider, seriesId, chapterId } = params.data;

  const rows = await db
    .select({ reaction: reactionsTable.reaction, count: count() })
    .from(reactionsTable)
    .where(
      and(
        eq(reactionsTable.provider, provider),
        eq(reactionsTable.seriesId, seriesId),
        eq(reactionsTable.chapterId, chapterId),
      ),
    )
    .groupBy(reactionsTable.reaction);

  let userReaction: string | null = null;
  if (req.session.userId) {
    const [myRow] = await db
      .select({ reaction: reactionsTable.reaction })
      .from(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, req.session.userId),
          eq(reactionsTable.provider, provider),
          eq(reactionsTable.seriesId, seriesId),
          eq(reactionsTable.chapterId, chapterId),
        ),
      );
    userReaction = myRow?.reaction ?? null;
  }

  res.json(buildSummary(rows.map(r => ({ reaction: r.reaction, count: Number(r.count) })), userReaction));
});

router.post("/reactions/:provider/:seriesId/:chapterId", requireAuth, async (req, res): Promise<void> => {
  const pathParams = AddReactionParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const bodyParsed = AddReactionBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const { provider, seriesId, chapterId } = pathParams.data;
  const { reaction } = bodyParsed.data;
  const userId = req.session.userId!;

  await db
    .insert(reactionsTable)
    .values({ userId, provider, seriesId, chapterId, reaction })
    .onConflictDoUpdate({
      target: [reactionsTable.userId, reactionsTable.provider, reactionsTable.seriesId, reactionsTable.chapterId],
      set: { reaction, updatedAt: new Date() },
    });

  const rows = await db
    .select({ reaction: reactionsTable.reaction, count: count() })
    .from(reactionsTable)
    .where(
      and(
        eq(reactionsTable.provider, provider),
        eq(reactionsTable.seriesId, seriesId),
        eq(reactionsTable.chapterId, chapterId),
      ),
    )
    .groupBy(reactionsTable.reaction);

  res.json(buildSummary(rows.map(r => ({ reaction: r.reaction, count: Number(r.count) })), reaction));
});

export default router;
