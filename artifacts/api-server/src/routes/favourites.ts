import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, favouritesTable } from "@workspace/db";
import { AddFavouriteBody, GetFavouritesResponse, RemoveFavouriteParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import "../lib/session";

const router: IRouter = Router();

router.get("/favourites", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const favourites = await db
    .select()
    .from(favouritesTable)
    .where(eq(favouritesTable.userId, userId))
    .orderBy(favouritesTable.createdAt);

  res.json(
    GetFavouritesResponse.parse(
      favourites.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/favourites", requireAuth, async (req, res): Promise<void> => {
  const parsed = AddFavouriteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;

  const [fav] = await db
    .insert(favouritesTable)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({
      target: [favouritesTable.userId, favouritesTable.provider, favouritesTable.seriesId],
      set: { title: parsed.data.title, coverImage: parsed.data.coverImage },
    })
    .returning();

  res.status(201).json({ ...fav, createdAt: fav.createdAt.toISOString() });
});

router.delete("/favourites/:provider/:seriesId", requireAuth, async (req, res): Promise<void> => {
  const params = RemoveFavouriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.session.userId!;

  await db
    .delete(favouritesTable)
    .where(
      and(
        eq(favouritesTable.userId, userId),
        eq(favouritesTable.provider, params.data.provider),
        eq(favouritesTable.seriesId, params.data.seriesId),
      ),
    );

  res.json({ message: "Favourite removed" });
});

export default router;
