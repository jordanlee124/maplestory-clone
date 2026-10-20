import { sql } from 'drizzle-orm';
import {
  bigint,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: uuid().primaryKey().defaultRandom(),
  /** Stored lowercase so usernames are case-insensitively unique. */
  username: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const characters = pgTable(
  'characters',
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    classId: text().notNull(),
    level: integer().notNull().default(1),
    exp: bigint({ mode: 'number' }).notNull().default(0),
    mapId: text().notNull(),
    x: doublePrecision().notNull(),
    y: doublePrecision().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('characters_name_lower_idx').on(sql`lower(${t.name})`),
    index('characters_account_idx').on(t.accountId),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type Character = typeof characters.$inferSelect;
