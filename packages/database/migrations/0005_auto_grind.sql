CREATE TABLE "auto_grind_configs" (
	"character_id" uuid PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_grind_configs" ADD CONSTRAINT "auto_grind_configs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;