-- Reverts the Phase 2 migrations (0003_character_skills, 0004_equipment, 0005_auto_grind,
-- 0006_forge_attempts).
-- Not run by the migrator. Run by hand, then delete the four newest rows of
-- drizzle.__drizzle_migrations. Worn equipment is parked in bag slots 1000+ rather than
-- deleted; skill levels, enhancement state, imprints, the item log and auto-grind settings
-- are dropped.
DROP TABLE IF EXISTS auto_grind_configs;
--> statement-breakpoint
DROP TABLE IF EXISTS item_transactions;
--> statement-breakpoint
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_one_place;
--> statement-breakpoint
WITH worn AS (
  SELECT id, row_number() OVER (PARTITION BY character_id ORDER BY id) AS n
  FROM inventory_items WHERE slot IS NULL
)
UPDATE inventory_items i SET slot = 999 + worn.n FROM worn WHERE i.id = worn.id;
--> statement-breakpoint
DROP INDEX IF EXISTS inventory_items_equip_slot_idx;
--> statement-breakpoint
ALTER TABLE inventory_items
  DROP COLUMN equip_slot,
  DROP COLUMN bonus,
  DROP COLUMN forge_level,
  DROP COLUMN forge_attempts,
  DROP COLUMN imprint_tier,
  DROP COLUMN imprints,
  DROP COLUMN imprint_rolls;
--> statement-breakpoint
ALTER TABLE inventory_items ALTER COLUMN slot SET NOT NULL;
--> statement-breakpoint
DROP TABLE IF EXISTS character_skills;
