// Phase 2 migrations keep existing data, and the rollback script restores the old shape.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from './index';

const run = async (db: PGlite, file: string) => {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim()) await db.exec(statement);
  }
};
const BEFORE = ['0000_init.sql', '0001_combat.sql', '0002_saved_vitals.sql'];
const PHASE_2 = [
  '0003_character_skills.sql',
  '0004_equipment.sql',
  '0005_auto_grind.sql',
  '0006_forge_attempts.sql',
];

describe('Phase 2 migrations', () => {
  it('upgrade existing characters and items in place, and roll back', async () => {
    const db = await PGlite.create();
    for (const f of BEFORE) await run(db, f);
    await db.exec(`
      INSERT INTO accounts (id, username, password_hash)
        VALUES ('00000000-0000-0000-0000-000000000001', 'old', 'x');
      INSERT INTO characters (id, account_id, name, class_id, level, exp, currency, map_id, x, y)
        VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
                'Oldie', 'runewaver', 7, 12, 99, 'fernreach-fields', 10, 640);
      INSERT INTO inventory_items (character_id, slot, item_id, quantity)
        VALUES ('00000000-0000-0000-0000-000000000002', 0, 'sprout-cap', 1),
               ('00000000-0000-0000-0000-000000000002', 1, 'ember-tonic', 7);
    `);

    for (const f of PHASE_2) await run(db, f);
    const c = await db.query('SELECT level, exp, currency FROM characters');
    expect(c.rows).toEqual([{ level: 7, exp: 12, currency: 99 }]);
    const items = await db.query(
      'SELECT slot, item_id, quantity, equip_slot, bonus, forge_level, imprint_tier FROM inventory_items ORDER BY slot',
    );
    expect(items.rows).toEqual([
      {
        slot: 0,
        item_id: 'sprout-cap',
        quantity: 1,
        equip_slot: null,
        bonus: [],
        forge_level: 0,
        imprint_tier: 0,
      },
      {
        slot: 1,
        item_id: 'ember-tonic',
        quantity: 7,
        equip_slot: null,
        bonus: [],
        forge_level: 0,
        imprint_tier: 0,
      },
    ]);
    // An item is in exactly one place.
    await expect(
      db.exec(`UPDATE inventory_items SET equip_slot = 'hat' WHERE slot = 0`),
    ).rejects.toThrow();
    await db.exec(`UPDATE inventory_items SET slot = NULL, equip_slot = 'hat' WHERE slot = 0`);

    await run(db, 'rollback/phase-2.sql');
    const after = await db.query(
      'SELECT slot, item_id, quantity FROM inventory_items ORDER BY slot',
    );
    expect(after.rows).toEqual([
      { slot: 1, item_id: 'ember-tonic', quantity: 7 },
      { slot: 1000, item_id: 'sprout-cap', quantity: 1 }, // was worn: parked, not lost
    ]);
    const tables = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    expect(tables.rows.map((t) => t.table_name)).toEqual([
      'accounts',
      'characters',
      'granted_rewards',
      'inventory_items',
    ]);
    await db.close();
  });
});
