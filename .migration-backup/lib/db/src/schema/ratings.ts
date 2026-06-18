import { pgTable, text, serial, integer, numeric, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  seriesId: text("series_id").notNull(),
  ratingValue: numeric("rating_value", { precision: 3, scale: 1 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique().on(t.userId, t.provider, t.seriesId),
  index("ratings_provider_series_idx").on(t.provider, t.seriesId),
]);

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
