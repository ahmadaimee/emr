ALTER TABLE "encounters" ADD COLUMN "disability_from" date;--> statement-breakpoint
ALTER TABLE "encounters" ADD COLUMN "disability_to" date;--> statement-breakpoint
ALTER TABLE "encounters" ADD COLUMN "outside_lab_performed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "encounters" ADD COLUMN "outside_lab_charges_cents" bigint;--> statement-breakpoint
ALTER TABLE "encounters" ADD COLUMN "additional_claim_info" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "delay_reason_code" text;