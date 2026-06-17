import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db, usersTable, bookmarksTable, favouritesTable, historyTable } from "@workspace/db";
import { UpdateProfileBody, ChangePasswordBody, GetProfileResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { count } from "drizzle-orm";
import "../lib/session";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [bookmarksCount] = await db
    .select({ count: count() })
    .from(bookmarksTable)
    .where(eq(bookmarksTable.userId, userId));

  const [favouritesCount] = await db
    .select({ count: count() })
    .from(favouritesTable)
    .where(eq(favouritesTable.userId, userId));

  const [chaptersRead] = await db
    .select({ count: count() })
    .from(historyTable)
    .where(eq(historyTable.userId, userId));

  res.json(
    GetProfileResponse.parse({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      stats: {
        bookmarksCount: Number(bookmarksCount?.count ?? 0),
        favouritesCount: Number(favouritesCount?.count ?? 0),
        chaptersRead: Number(chaptersRead?.count ?? 0),
      },
    }),
  );
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.username !== undefined) updates.username = parsed.data.username;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();

  const [bookmarksCount] = await db
    .select({ count: count() })
    .from(bookmarksTable)
    .where(eq(bookmarksTable.userId, userId));

  const [favouritesCount] = await db
    .select({ count: count() })
    .from(favouritesTable)
    .where(eq(favouritesTable.userId, userId));

  const [chaptersRead] = await db
    .select({ count: count() })
    .from(historyTable)
    .where(eq(historyTable.userId, userId));

  res.json(
    GetProfileResponse.parse({
      id: updated.id,
      username: updated.username,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
      stats: {
        bookmarksCount: Number(bookmarksCount?.count ?? 0),
        favouritesCount: Number(favouritesCount?.count ?? 0),
        chaptersRead: Number(chaptersRead?.count ?? 0),
      },
    }),
  );
});

router.patch("/profile/password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash })
    .where(eq(usersTable.id, userId));

  res.json({ message: "Password changed successfully" });
});

router.delete("/profile/account", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  req.session.destroy(() => {});
  res.json({ message: "Account deleted" });
});

export default router;
