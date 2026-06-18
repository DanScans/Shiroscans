import { Router, type IRouter } from "express";
import { eq, and, avg, count } from "drizzle-orm";
import { db, ratingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import "../lib/session";

const router: IRouter = Router();

// GET /api/ratings/:provider/:seriesId
// Returns aggregate rating + user's own rating if authenticated
router.get("/ratings/:provider/:seriesId", async (req, res): Promise<void> => {
  const { provider, seriesId } = req.params;

  const [agg] = await db
    .select({ average: avg(ratingsTable.ratingValue), total: count() })
    .from(ratingsTable)
    .where(and(eq(ratingsTable.provider, provider), eq(ratingsTable.seriesId, seriesId)));

  let userRating: number | null = null;
  if (req.session.userId) {
    const [row] = await db
      .select({ ratingValue: ratingsTable.ratingValue })
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.userId, req.session.userId),
          eq(ratingsTable.provider, provider),
          eq(ratingsTable.seriesId, seriesId),
        ),
      );
    userRating = row ? Number(row.ratingValue) : null;
  }

  res.json({
    average: agg?.average != null ? Number(Number(agg.average).toFixed(1)) : null,
    total: Number(agg?.total ?? 0),
    userRating,
  });
});

// POST /api/ratings — create or update rating
// Body: { provider, seriesId, ratingValue }
router.post("/ratings", requireAuth, async (req, res): Promise<void> => {
  const { provider, seriesId, ratingValue } = req.body as {
    provider?: string; seriesId?: string; ratingValue?: unknown;
  };

  if (!provider || !seriesId) {
    res.status(400).json({ error: "provider and seriesId are required" });
    return;
  }

  const val = Number(ratingValue);
  if (!Number.isFinite(val) || val < 1 || val > 10) {
    res.status(400).json({ error: "ratingValue must be 1–10" });
    return;
  }

  const userId = req.session.userId!;

  await db
    .insert(ratingsTable)
    .values({ userId, provider, seriesId, ratingValue: String(val) })
    .onConflictDoUpdate({
      target: [ratingsTable.userId, ratingsTable.provider, ratingsTable.seriesId],
      set: { ratingValue: String(val), updatedAt: new Date() },
    });

  const [agg] = await db
    .select({ average: avg(ratingsTable.ratingValue), total: count() })
    .from(ratingsTable)
    .where(and(eq(ratingsTable.provider, provider), eq(ratingsTable.seriesId, seriesId)));

  res.json({
    average: agg?.average != null ? Number(Number(agg.average).toFixed(1)) : null,
    total: Number(agg?.total ?? 0),
    userRating: val,
  });
});

// DELETE /api/ratings/:provider/:seriesId
router.delete("/ratings/:provider/:seriesId", requireAuth, async (req, res): Promise<void> => {
  const { provider, seriesId } = req.params;
  const userId = req.session.userId!;

  await db.delete(ratingsTable).where(
    and(
      eq(ratingsTable.userId, userId),
      eq(ratingsTable.provider, provider),
      eq(ratingsTable.seriesId, seriesId),
    ),
  );

  res.json({ success: true });
});

export default router;
