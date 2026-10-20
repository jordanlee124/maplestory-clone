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
    currency: bigint({ mode: 'number' }).notNull().default(0),
    /** Saved on leave; null = full (new character). 0 = left while dead. */
    hp: integer(),
    mp: integer(),
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

/** One row per occupied inventory slot. */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    characterId: uuid()
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    slot: integer().notNull(),
    itemId: text().notNull(),
    quantity: integer().notNull(),
  },
  (t) => [uniqueIndex('inventory_items_slot_idx').on(t.characterId, t.slot)],
);

/**
 * Idempotency ledger: every EXP/loot grant inserts a unique key in the same transaction as
 * the reward, so a replayed or duplicated grant is a no-op.
 */
export const grantedRewards = pgTable('granted_rewards', {
  key: text().primaryKey(),
  characterId: uuid()
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
