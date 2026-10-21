import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

/** One rolled stat line (equipment bonus stats and imprints). */
export interface StatLineRow {
  stat: string;
  value: number;
}

/**
 * One row per item stack. An equipment row (quantity 1) is one equipment instance: its id is
 * the instance id, and it carries its own rolls and enhancement state. A row is either in a
 * bag `slot` or worn in `equipSlot`, never both.
 */
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    characterId: uuid()
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    slot: integer(),
    equipSlot: text(),
    itemId: text().notNull(),
    quantity: integer().notNull(),
    /** Bonus stat lines rolled once at creation. */
    bonus: jsonb().$type<StatLineRow[]>().notNull().default([]),
    /** Forge Ascension level. */
    forgeLevel: integer().notNull().default(0),
    /** Arcane Imprint tier (0 = none), its lines, and the reroll count (request idempotency). */
    imprintTier: integer().notNull().default(0),
    imprints: jsonb().$type<StatLineRow[]>().notNull().default([]),
    imprintRolls: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex('inventory_items_slot_idx').on(t.characterId, t.slot),
    uniqueIndex('inventory_items_equip_slot_idx').on(t.characterId, t.equipSlot),
    check('inventory_items_one_place', sql`(${t.slot} is null) <> (${t.equipSlot} is null)`),
  ],
);

/**
 * Audit log of item and currency changes made by player operations (equip, forge, imprint,
 * use), written in the same transaction as the change.
 */
export const itemTransactions = pgTable(
  'item_transactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    characterId: uuid()
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    inventoryItemId: uuid().references(() => inventoryItems.id, { onDelete: 'set null' }),
    currencyDelta: bigint({ mode: 'number' }).notNull().default(0),
    /** Operation details, including the content table version used for random outcomes. */
    detail: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('item_transactions_character_idx').on(t.characterId, t.createdAt)],
);

/** Learned skill levels. Innate skills have no row until raised past level 1. */
export const characterSkills = pgTable(
  'character_skills',
  {
    characterId: uuid()
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    skillId: text().notNull(),
    level: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.skillId] })],
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

/** Saved auto-grind settings; whether automation is running is never stored. */
export const autoGrindConfigs = pgTable('auto_grind_configs', {
  characterId: uuid()
    .primaryKey()
    .references(() => characters.id, { onDelete: 'cascade' }),
  /** Validated with the protocol's AutoGrindConfig schema on write and on load. */
  config: jsonb().$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
