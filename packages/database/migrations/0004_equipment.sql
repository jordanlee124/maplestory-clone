CREATE TABLE "item_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"inventory_item_id" uuid,
	"currency_delta" bigint DEFAULT 0 NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ALTER COLUMN "slot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "equip_slot" text;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "bonus" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "forge_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "imprint_tier" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "imprints" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "imprint_rolls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "item_transactions" ADD CONSTRAINT "item_transactions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_transactions" ADD CONSTRAINT "item_transactions_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_transactions_character_idx" ON "item_transactions" USING btree ("character_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_equip_slot_idx" ON "inventory_items" USING btree ("character_id","equip_slot");--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_one_place" CHECK (("inventory_items"."slot" is null) <> ("inventory_items"."equip_slot" is null));