CREATE TYPE "public"."authorization_status" AS ENUM('draft', 'submitted', 'pending', 'approved', 'partially_approved', 'denied', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."authorization_urgency" AS ENUM('routine', 'urgent');--> statement-breakpoint
CREATE TABLE "authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"coverage_id" uuid,
	"rendering_provider_id" uuid,
	"status" "authorization_status" DEFAULT 'draft' NOT NULL,
	"urgency" "authorization_urgency" DEFAULT 'routine' NOT NULL,
	"procedure_codes" text[] DEFAULT '{}' NOT NULL,
	"diagnosis_codes" text[] DEFAULT '{}' NOT NULL,
	"service_date_from" date NOT NULL,
	"service_date_through" date,
	"units_requested" integer,
	"units_approved" integer,
	"units_used" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"authorization_number" text,
	"expires_on" date,
	"payer_response_code" text,
	"payer_response_message" text,
	"raw_request_278" text,
	"notes" text,
	"review_required" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "prior_auth_number" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "authorization_id" uuid;--> statement-breakpoint
CREATE INDEX "authorizations_patient_idx" ON "authorizations" USING btree ("org_id","patient_id");--> statement-breakpoint
CREATE INDEX "authorizations_practice_status_idx" ON "authorizations" USING btree ("org_id","practice_id","status");--> statement-breakpoint
CREATE INDEX "authorizations_due_idx" ON "authorizations" USING btree ("org_id","status","due_at");--> statement-breakpoint
CREATE INDEX "authorizations_payer_idx" ON "authorizations" USING btree ("org_id","payer_id");