import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const historyTable = pgTable("history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  seriesId: text("series_id").notNull(),
  chapterId: text("chapter_id").notNull(),
  title: text("title").notNull(),
  coverImage: text("cover_image").notNull(),
  chapterNumber: text("chapter_number").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique().on(t.userId, t.provider, t.seriesId),
]);

export const insertHistorySchema = createInsertSchema(historyTable).omit({ id: true, readAt: true });
export type InsertHistory = z.infer<typeof insertHistorySchema>;
export type History = typeof historyTable.$inferSelect;
