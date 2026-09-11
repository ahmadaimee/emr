CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'checked_in', 'in_room', 'completed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('new', 'followup', 'annual', 'telehealth', 'procedure', 'labs');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_date" date NOT NULL,
	"start_minutes" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"type" "appointment_type" DEFAULT 'followup' NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"reason" text,
	"room" text,
	"expected_copay_cents" bigint,
	"cancel_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "appointments_provider_date_idx" ON "appointments" USING btree ("org_id","provider_id","appointment_date");--> statement-breakpoint
CREATE INDEX "appointments_practice_date_idx" ON "appointments" USING btree ("org_id","practice_id","appointment_date");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("org_id","patient_id");