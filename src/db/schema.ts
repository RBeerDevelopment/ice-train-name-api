import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const trains = sqliteTable('trains', {
    id: text('id').$defaultFn(createId).primaryKey(),
    tz: integer('tz').notNull(),
    name: text('name').notNull(),
    classId: integer('class_id').notNull().references(() => classes.id),
    comment: text('comment'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    nameSince: integer('name_since', { mode: 'timestamp' }).notNull(),
    nameUntil: integer('name_until', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
},
(table) => [
    uniqueIndex('active_tz_index').on(table.tz).where(sql`is_active = 1`),
    index("name_index").on(table.name)
  ]);

export const classes = sqliteTable('classes', {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
});