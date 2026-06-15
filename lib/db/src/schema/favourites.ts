import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const favouritesTable = pgTable("favourites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  seriesId: text("series_id").notNull(),
  title: text("title").notNull(),
  coverImage: text("cover_image").notNull(),
  type: text("type"),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.userId, t.provider, t.seriesId),
]);

export const insertFavouriteSchema = createInsertSchema(favouritesTable).omit({ id: true, createdAt: true });
export type InsertFavourite = z.infer<typeof insertFavouriteSchema>;
export type Favourite = typeof favouritesTable.$inferSelect;
