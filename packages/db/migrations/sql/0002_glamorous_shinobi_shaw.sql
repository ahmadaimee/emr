ALTER TABLE "practices" ADD COLUMN "clia_number" text;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "eft_enrollment_status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "eft_bank_name" text;--> statement-breakpoint
ALTER TABLE "provider_enrollments" ADD COLUMN "era_enrollment_status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_enrollments" ADD COLUMN "eft_enrollment_status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_enrollments" ADD COLUMN "trading_partner_agreement_signed_on" date;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "caqh_number" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "caqh_attested_at" date;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "board_certifications" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "malpractice_carrier" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "malpractice_policy_number" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "malpractice_expires_on" date;--> statement-breakpoint
ALTER TABLE "document_links" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
CREATE INDEX "document_links_provider_idx" ON "document_links" USING btree ("org_id","provider_id");