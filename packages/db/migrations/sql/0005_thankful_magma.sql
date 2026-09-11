CREATE TYPE "public"."clinical_note_status" AS ENUM('draft', 'signed', 'amended');--> statement-breakpoint
CREATE TABLE "clinical_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid,
	"author_user_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"status" "clinical_note_status" DEFAULT 'draft' NOT NULL,
	"blood_pressure_systolic" integer,
	"blood_pressure_diastolic" integer,
	"heart_rate" integer,
	"temperature_f" double precision,
	"respiratory_rate" integer,
	"spo2" integer,
	"weight_lbs" double precision,
	"height_inches" double precision,
	"subjective" text NOT NULL,
	"objective" text NOT NULL,
	"primary_diagnosis_code" text NOT NULL,
	"primary_diagnosis_description" text NOT NULL,
	"plan" text NOT NULL,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "clinical_notes_patient_idx" ON "clinical_notes" USING btree ("org_id","patient_id","service_date");