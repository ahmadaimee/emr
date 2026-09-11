CREATE TYPE "public"."provider_type" AS ENUM('rendering', 'billing', 'supervising', 'referring');--> statement-breakpoint
CREATE TYPE "public"."mfa_method_type" AS ENUM('totp', 'webauthn', 'recovery_code');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'suspended', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."patient_sex" AS ENUM('M', 'F', 'U');--> statement-breakpoint
CREATE TYPE "public"."payer_type" AS ENUM('medicare', 'medicaid', 'commercial', 'blue_cross', 'tricare', 'champva', 'workers_comp', 'auto_medical', 'self_pay', 'other');--> statement-breakpoint
CREATE TYPE "public"."coverage_rank" AS ENUM('primary', 'secondary', 'tertiary');--> statement-breakpoint
CREATE TYPE "public"."eligibility_batch_status" AS ENUM('draft', 'queued', 'running', 'completed', 'completed_with_errors', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."eligibility_status" AS ENUM('queued', 'sent', 'active', 'inactive', 'not_found', 'payer_error', 'invalid_request', 'transport_error');--> statement-breakpoint
CREATE TYPE "public"."eligibility_trigger" AS ENUM('manual', 'batch', 'pre_appointment', 'check_in', 'periodic_reverification', 'pre_claim', 'api');--> statement-breakpoint
CREATE TYPE "public"."encounter_status" AS ENUM('open', 'ready_to_bill', 'billed', 'on_hold', 'voided');--> statement-breakpoint
CREATE TYPE "public"."acknowledgment_type" AS ENUM('ta1', 'x999', 'x277ca', 'connector');--> statement-breakpoint
CREATE TYPE "public"."claim_frequency" AS ENUM('original', 'replacement', 'void');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('draft', 'scrubbing', 'needs_review', 'ready', 'queued', 'submitted', 'acknowledged', 'rejected', 'in_process', 'paid', 'partially_paid', 'denied', 'appealed', 'secondary_ready', 'secondary_submitted', 'patient_responsibility', 'closed', 'voided');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('professional', 'institutional', 'dental');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('queued', 'sent', 'transport_failed', 'acknowledged', 'rejected', 'accepted_with_errors');--> statement-breakpoint
CREATE TYPE "public"."cas_group_code" AS ENUM('CO', 'PR', 'OA', 'PI', 'CR');--> statement-breakpoint
CREATE TYPE "public"."remittance_status" AS ENUM('received', 'parsed', 'balanced', 'out_of_balance', 'posting', 'posted', 'partially_posted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('charge', 'payment_insurance', 'payment_patient', 'contractual_adjustment', 'write_off', 'transfer_to_patient', 'transfer_to_secondary', 'refund', 'recoupment', 'interest', 'reversal', 'bad_debt');--> statement-breakpoint
CREATE TYPE "public"."responsibility_party" AS ENUM('insurance', 'patient', 'none');--> statement-breakpoint
CREATE TYPE "public"."payment_source" AS ENUM('era', 'manual_eob', 'patient_card', 'patient_ach', 'patient_check', 'patient_cash', 'payment_plan', 'refund');--> statement-breakpoint
CREATE TYPE "public"."statement_status" AS ENUM('draft', 'queued', 'sent', 'delivered', 'viewed', 'paid', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'in_progress', 'waiting', 'snoozed', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rule_severity" AS ENUM('error', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."rule_status" AS ENUM('draft', 'testing', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'read', 'update', 'delete', 'login', 'login_failed', 'logout', 'export', 'print', 'submit', 'post', 'void', 'elevate_access', 'permission_change', 'config_change');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'delivered', 'failed', 'exhausted');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"name" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text DEFAULT 'US' NOT NULL,
	"npi" text,
	"place_of_service" text,
	"mac_jurisdiction" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"edi_submitter_id" text,
	"edi_submitter_name" text,
	"edi_usage_indicator" text DEFAULT 'T' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"npi" text,
	"tax_id" text,
	"tax_id_type" text DEFAULT 'EI' NOT NULL,
	"taxonomy_code" text,
	"default_place_of_service" text,
	"accepts_assignment" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"ptan" text,
	"provider_number" text,
	"enrolled_taxonomy_code" text,
	"effective_date" date,
	"termination_date" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"middle_name" text,
	"suffix" text,
	"credentials" text,
	"npi" text NOT NULL,
	"taxonomy_code" text,
	"dea_number" text,
	"state_license" text,
	"license_state" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_elevations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"scope" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "mfa_method_type" NOT NULL,
	"label" text,
	"secret_encrypted" text,
	"key_version" integer DEFAULT 1 NOT NULL,
	"credential_id" text,
	"public_key" text,
	"sign_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"constraints" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"mfa_satisfied_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_practice_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" "citext" NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"password_hash" text,
	"password_changed_at" timestamp with time zone,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"mfa_enrolled_at" timestamp with time zone,
	"provider_id" uuid,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guarantors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"relationship_code" text DEFAULT '18' NOT NULL,
	"date_of_birth" date,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"phone" text,
	"email" "citext",
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_match_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"candidate_patient_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"signals" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"mrn" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"middle_name" text,
	"suffix" text,
	"preferred_name" text,
	"date_of_birth" date NOT NULL,
	"sex" "patient_sex" NOT NULL,
	"ssn_encrypted" text,
	"ssn_key_version" integer,
	"ssn_last4" text,
	"email" "citext",
	"phone_home" text,
	"phone_mobile" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country_code" text DEFAULT 'US' NOT NULL,
	"preferred_language" text DEFAULT 'en' NOT NULL,
	"allow_sms" boolean DEFAULT false NOT NULL,
	"allow_email" boolean DEFAULT false NOT NULL,
	"statement_delivery_method" text DEFAULT 'mail' NOT NULL,
	"deceased_date" date,
	"merged_into_patient_id" uuid,
	"merged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_schedule_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"fee_schedule_id" uuid NOT NULL,
	"procedure_code" text NOT NULL,
	"modifier1" text,
	"modifier2" text,
	"non_facility_rate_cents" bigint,
	"facility_rate_cents" bigint,
	"work_rvu_millis" integer,
	"practice_expense_rvu_millis" integer,
	"malpractice_rvu_millis" integer,
	"effective_date" date,
	"termination_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"contract_id" uuid,
	"practice_id" uuid,
	"name" text NOT NULL,
	"schedule_type" text DEFAULT 'allowed' NOT NULL,
	"effective_date" date NOT NULL,
	"termination_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payer_behavior_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"practice_id" uuid,
	"median_days_to_remit" integer,
	"p90_days_to_remit" integer,
	"median_days_to_acknowledge" integer,
	"denial_rate_bps" integer,
	"first_pass_rate_bps" integer,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"computed_at" date,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payer_connector_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"connector" text NOT NULL,
	"connector_payer_id" text NOT NULL,
	"connector_eligibility_payer_id" text,
	"enrollment_required" boolean DEFAULT false NOT NULL,
	"enrollment_status" text DEFAULT 'not_required' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payer_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"plan_id" uuid,
	"name" text NOT NULL,
	"effective_date" date NOT NULL,
	"termination_date" date,
	"reimbursement_method" text DEFAULT 'fee_schedule' NOT NULL,
	"medicare_percentage_bps" integer,
	"medicare_locality" text,
	"underpayment_tolerance_cents" bigint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payer_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"plan_type" text,
	"timely_filing_days" integer,
	"timely_filing_secondary_days" integer,
	"appeal_filing_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "payer_type" NOT NULL,
	"payer_id_code" text,
	"claim_filing_indicator" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"supports_eligibility" boolean DEFAULT true NOT NULL,
	"supports_claim_status" boolean DEFAULT true NOT NULL,
	"supports_era" boolean DEFAULT true NOT NULL,
	"supports_secondary_electronic" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_case_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"coverage_id" uuid NOT NULL,
	"claim_number" text,
	"date_of_injury" date,
	"employer_name" text,
	"adjuster_name" text,
	"adjuster_phone" text,
	"authorization_number" text,
	"authorized_visits" integer,
	"authorized_visits_used" integer DEFAULT 0 NOT NULL,
	"authorization_start_date" date,
	"authorization_end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"plan_id" uuid,
	"rank" "coverage_rank" NOT NULL,
	"member_id" "citext" NOT NULL,
	"group_number" text,
	"group_name" text,
	"relationship_code" text DEFAULT '18' NOT NULL,
	"subscriber_first_name" text,
	"subscriber_last_name" text,
	"subscriber_date_of_birth" date,
	"subscriber_sex" text,
	"subscriber_address_line1" text,
	"subscriber_city" text,
	"subscriber_state" text,
	"subscriber_postal_code" text,
	"effective_date" date,
	"termination_date" date,
	"assignment_of_benefits" boolean DEFAULT true NOT NULL,
	"release_of_information" text DEFAULT 'Y' NOT NULL,
	"last_verified_at" date,
	"last_verified_status" text,
	"last_verified_eligibility_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eligibility_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "eligibility_batch_status" DEFAULT 'draft' NOT NULL,
	"source_type" text NOT NULL,
	"source_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"service_date" date,
	"service_type_codes" text[],
	"total_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"active_count" integer DEFAULT 0 NOT NULL,
	"inactive_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"changed_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"schedule_cron" text,
	"schedule_timezone" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eligibility_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"eligibility_check_id" uuid NOT NULL,
	"benefit_code" text NOT NULL,
	"benefit_description" text,
	"coverage_level" text,
	"service_type_code" text,
	"service_type_description" text,
	"insurance_type_code" text,
	"plan_description" text,
	"time_period_qualifier" text,
	"amount_cents" bigint,
	"percent_bps" integer,
	"quantity_qualifier" text,
	"quantity" integer,
	"in_network" boolean,
	"authorization_required" boolean,
	"messages" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eligibility_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"coverage_id" uuid,
	"payer_id" uuid NOT NULL,
	"provider_id" uuid,
	"batch_id" uuid,
	"encounter_id" uuid,
	"appointment_id" uuid,
	"trigger" "eligibility_trigger" NOT NULL,
	"status" "eligibility_status" DEFAULT 'queued' NOT NULL,
	"service_type_codes" text[],
	"service_date" date,
	"connector" text,
	"connector_transaction_id" text,
	"control_number" text,
	"requested_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"latency_ms" integer,
	"reported_plan_begin" date,
	"reported_plan_end" date,
	"reject_reason_code" text,
	"reject_reason_text" text,
	"follow_up_action_code" text,
	"raw_request" text,
	"raw_response" text,
	"parsed" jsonb,
	"has_changes" boolean DEFAULT false NOT NULL,
	"change_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"encounter_number" text NOT NULL,
	"status" "encounter_status" DEFAULT 'open' NOT NULL,
	"service_date" date NOT NULL,
	"service_date_through" date,
	"rendering_provider_id" uuid NOT NULL,
	"billing_provider_id" uuid,
	"supervising_provider_id" uuid,
	"referring_provider_id" uuid,
	"place_of_service" text NOT NULL,
	"diagnosis_codes" text[] DEFAULT '{}' NOT NULL,
	"related_to_employment" boolean DEFAULT false NOT NULL,
	"related_to_auto_accident" boolean DEFAULT false NOT NULL,
	"related_to_other_accident" boolean DEFAULT false NOT NULL,
	"accident_state" text,
	"accident_date" date,
	"onset_date" date,
	"initial_treatment_date" date,
	"last_seen_date" date,
	"hospitalized_from" date,
	"hospitalized_to" date,
	"prior_authorization_number" text,
	"referral_number" text,
	"clia_number" text,
	"notes" text,
	"total_charge_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"encounter_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"procedure_code" text NOT NULL,
	"procedure_description" text,
	"modifier1" text,
	"modifier2" text,
	"modifier3" text,
	"modifier4" text,
	"diagnosis_pointers" integer[] DEFAULT '{}' NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"unit_type" text DEFAULT 'UN' NOT NULL,
	"charge_cents" bigint NOT NULL,
	"expected_allowed_cents" bigint,
	"service_date" date NOT NULL,
	"service_date_through" date,
	"place_of_service" text,
	"rendering_provider_id" uuid,
	"ndc_code" text,
	"ndc_quantity_millis" integer,
	"ndc_unit_of_measure" text,
	"emergency" boolean DEFAULT false NOT NULL,
	"epsdt" boolean DEFAULT false NOT NULL,
	"family_planning" boolean DEFAULT false NOT NULL,
	"abn_obtained" boolean DEFAULT false NOT NULL,
	"abn_date" date,
	"allowed_cents" bigint DEFAULT 0 NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"adjustment_cents" bigint DEFAULT 0 NOT NULL,
	"patient_responsibility_cents" bigint DEFAULT 0 NOT NULL,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"voided_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_acknowledgments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid,
	"claim_submission_id" uuid,
	"type" "acknowledgment_type" NOT NULL,
	"result_code" text NOT NULL,
	"status_category_code" text,
	"status_code" text,
	"entity_code" text,
	"message" text,
	"segment_id" text,
	"segment_position" integer,
	"element_position" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_content" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_custom_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"label" text NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_line_prior_adjudications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"service_line_id" uuid NOT NULL,
	"prior_payer_id" uuid NOT NULL,
	"prior_remittance_line_id" uuid,
	"prior_payer_claim_control_number" text,
	"procedure_code" text NOT NULL,
	"modifiers" text[],
	"paid_amount_cents" bigint NOT NULL,
	"paid_units" integer,
	"adjudication_date" date NOT NULL,
	"adjustments" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"trigger" text NOT NULL,
	"reason" text,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_status_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"connector" text,
	"requested_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"status_category_code" text,
	"status_code" text,
	"status_description" text,
	"is_final" boolean DEFAULT false NOT NULL,
	"paid_amount_cents" bigint,
	"effective_date" date,
	"raw_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"claim_version_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" "submission_status" DEFAULT 'queued' NOT NULL,
	"connector" text NOT NULL,
	"connector_submission_id" text,
	"connector_batch_id" text,
	"isa_control_number" text,
	"gs_control_number" text,
	"st_control_number" text,
	"sent_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"is_paper" boolean DEFAULT false NOT NULL,
	"paper_form_document_id" uuid,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"x12" text,
	"content_hash" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid NOT NULL,
	"coverage_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"claim_number" text NOT NULL,
	"type" "claim_type" DEFAULT 'professional' NOT NULL,
	"status" "claim_status" DEFAULT 'draft' NOT NULL,
	"frequency" "claim_frequency" DEFAULT 'original' NOT NULL,
	"coverage_rank" text DEFAULT 'primary' NOT NULL,
	"original_claim_id" uuid,
	"payer_claim_control_number" text,
	"primary_remittance_claim_id" uuid,
	"total_charge_cents" bigint DEFAULT 0 NOT NULL,
	"total_allowed_cents" bigint DEFAULT 0 NOT NULL,
	"total_paid_cents" bigint DEFAULT 0 NOT NULL,
	"total_adjustment_cents" bigint DEFAULT 0 NOT NULL,
	"patient_responsibility_cents" bigint DEFAULT 0 NOT NULL,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"service_date_from" date NOT NULL,
	"service_date_through" date,
	"timely_filing_deadline" date,
	"appeal_deadline" date,
	"submitted_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"first_remittance_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"denial_risk_score" integer,
	"denial_risk_factors" jsonb,
	"created_by_automation" text,
	"custom_status_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payer_formatter_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"claim_type" text DEFAULT 'professional' NOT NULL,
	"target" text NOT NULL,
	"operation" text NOT NULL,
	"value" jsonb,
	"reason" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "denials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"remittance_claim_id" uuid,
	"remittance_line_id" uuid,
	"payer_id" uuid NOT NULL,
	"group_code" text NOT NULL,
	"reason_code" text NOT NULL,
	"remark_codes" text[],
	"denied_amount_cents" bigint DEFAULT 0 NOT NULL,
	"category" text NOT NULL,
	"preventable" boolean,
	"suggested_action" text,
	"suggested_action_detail" jsonb,
	"auto_resolvable" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"work_queue_id" uuid,
	"assigned_to" uuid,
	"appeal_deadline" date,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"recovered_amount_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_level_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"remittance_id" uuid NOT NULL,
	"provider_identifier" text,
	"fiscal_period_date" date,
	"adjustment_reason_code" text NOT NULL,
	"reference_identifier" text,
	"amount_cents" bigint NOT NULL,
	"related_claim_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remittance_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"remittance_claim_id" uuid,
	"remittance_line_id" uuid,
	"group_code" "cas_group_code" NOT NULL,
	"reason_code" text NOT NULL,
	"reason_description" text,
	"amount_cents" bigint NOT NULL,
	"quantity" integer,
	"is_denial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remittance_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"remittance_id" uuid NOT NULL,
	"claim_id" uuid,
	"patient_control_number" text NOT NULL,
	"claim_status_code" text NOT NULL,
	"total_charge_cents" bigint DEFAULT 0 NOT NULL,
	"total_paid_cents" bigint DEFAULT 0 NOT NULL,
	"patient_responsibility_cents" bigint DEFAULT 0 NOT NULL,
	"payer_claim_control_number" text,
	"claim_filing_indicator" text,
	"crossover_carrier_name" text,
	"crossover_carrier_id" text,
	"remark_codes" text[],
	"out_of_balance" boolean DEFAULT false NOT NULL,
	"variance_cents" bigint DEFAULT 0 NOT NULL,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remittance_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"remittance_claim_id" uuid NOT NULL,
	"service_line_id" uuid,
	"line_number" integer,
	"procedure_code" text NOT NULL,
	"modifier1" text,
	"modifier2" text,
	"modifier3" text,
	"modifier4" text,
	"adjudicated_procedure_code" text,
	"charge_cents" bigint DEFAULT 0 NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"allowed_cents" bigint DEFAULT 0 NOT NULL,
	"units_billed" integer,
	"units_paid" integer,
	"service_date" date,
	"remark_codes" text[],
	"expected_allowed_cents" bigint,
	"underpayment_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remittances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"payer_id" uuid,
	"status" "remittance_status" DEFAULT 'received' NOT NULL,
	"payment_method" text,
	"total_paid_cents" bigint DEFAULT 0 NOT NULL,
	"payment_date" date,
	"trace_number" text,
	"payer_identifier" text,
	"check_number" text,
	"payer_name" text,
	"payee_name" text,
	"payee_npi" text,
	"computed_claim_total_cents" bigint DEFAULT 0 NOT NULL,
	"provider_adjustment_total_cents" bigint DEFAULT 0 NOT NULL,
	"balance_variance_cents" bigint DEFAULT 0 NOT NULL,
	"connector" text,
	"connector_file_id" text,
	"raw_file_key" text,
	"file_name" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"insurance_balance_cents" bigint DEFAULT 0 NOT NULL,
	"patient_balance_cents" bigint DEFAULT 0 NOT NULL,
	"total_charged_cents" bigint DEFAULT 0 NOT NULL,
	"total_paid_cents" bigint DEFAULT 0 NOT NULL,
	"total_adjusted_cents" bigint DEFAULT 0 NOT NULL,
	"last_entry_at" timestamp with time zone,
	"last_reconciled_at" timestamp with time zone,
	"reconciliation_variance_cents" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid,
	"claim_id" uuid,
	"service_line_id" uuid,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"responsibility" "responsibility_party" NOT NULL,
	"payer_id" uuid,
	"posting_date" date NOT NULL,
	"service_date" date NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"reverses_entry_id" uuid,
	"payment_batch_id" uuid,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dunning_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"name" text NOT NULL,
	"schedule" jsonb NOT NULL,
	"minimum_balance_cents" bigint DEFAULT 500 NOT NULL,
	"collections_after_days" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_payment_method_id" text NOT NULL,
	"method_type" text NOT NULL,
	"brand" text,
	"last4" text,
	"exp_month" integer,
	"exp_year" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"auto_charge_consent_at" timestamp with time zone,
	"auto_charge_max_cents" bigint,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"guarantor_id" uuid,
	"statement_run_id" uuid,
	"statement_number" text NOT NULL,
	"cycle_number" integer DEFAULT 1 NOT NULL,
	"statement_date" date NOT NULL,
	"due_date" date NOT NULL,
	"previous_balance_cents" bigint DEFAULT 0 NOT NULL,
	"new_charges_cents" bigint DEFAULT 0 NOT NULL,
	"payments_cents" bigint DEFAULT 0 NOT NULL,
	"adjustments_cents" bigint DEFAULT 0 NOT NULL,
	"balance_due_cents" bigint DEFAULT 0 NOT NULL,
	"delivery_method" text NOT NULL,
	"status" "statement_status" DEFAULT 'draft' NOT NULL,
	"document_id" uuid,
	"pay_link_token" text,
	"pay_link_expires_at" timestamp with time zone,
	"vendor_reference" text,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"propensity_score" integer,
	"propensity_factors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"service_line_id" uuid NOT NULL,
	"claim_id" uuid,
	"amount_cents" bigint NOT NULL,
	"ledger_entry_id" uuid,
	"applied_by" uuid,
	"reversal_of_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"batch_type" text NOT NULL,
	"deposit_date" date NOT NULL,
	"expected_total_cents" bigint DEFAULT 0 NOT NULL,
	"posted_total_cents" bigint DEFAULT 0 NOT NULL,
	"bank_reference" text,
	"remittance_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"payment_method_id" uuid,
	"total_cents" bigint NOT NULL,
	"installment_cents" bigint NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"next_charge_date" date NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"missed_payments" integer DEFAULT 0 NOT NULL,
	"agreed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"payment_batch_id" uuid NOT NULL,
	"source" "payment_source" NOT NULL,
	"payer_id" uuid,
	"patient_id" uuid,
	"amount_cents" bigint NOT NULL,
	"received_date" date NOT NULL,
	"reference" text,
	"remittance_id" uuid,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"card_brand" text,
	"card_last4" text,
	"applied_cents" bigint DEFAULT 0 NOT NULL,
	"unapplied_cents" bigint DEFAULT 0 NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"statement_id" uuid NOT NULL,
	"encounter_id" uuid,
	"service_line_id" uuid,
	"service_date" date,
	"description" text NOT NULL,
	"charge_cents" bigint DEFAULT 0 NOT NULL,
	"insurance_paid_cents" bigint DEFAULT 0 NOT NULL,
	"adjustment_cents" bigint DEFAULT 0 NOT NULL,
	"patient_paid_cents" bigint DEFAULT 0 NOT NULL,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"run_date" date NOT NULL,
	"minimum_balance_cents" bigint DEFAULT 500 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"statement_count" integer DEFAULT 0 NOT NULL,
	"total_balance_cents" bigint DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"dataset" text NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_user_id" uuid,
	"detail" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"work_queue_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"patient_id" uuid,
	"title" text NOT NULL,
	"detail" jsonb,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"suggested_action" text,
	"suggested_action_payload" jsonb,
	"assigned_to" uuid,
	"assigned_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_code" text,
	"resolution_note" text,
	"dedupe_key" text,
	"created_by_automation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_queues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assignment_strategy" text DEFAULT 'manual' NOT NULL,
	"sla_hours" integer,
	"is_system" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_backtests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"date_from" text NOT NULL,
	"date_to" text NOT NULL,
	"practice_ids" uuid[],
	"claims_evaluated" integer DEFAULT 0 NOT NULL,
	"claims_flagged" integer DEFAULT 0 NOT NULL,
	"true_positives" integer DEFAULT 0 NOT NULL,
	"false_positives" integer DEFAULT 0 NOT NULL,
	"dollars_at_risk_cents" bigint DEFAULT 0 NOT NULL,
	"sample_findings" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"scope_type" text NOT NULL,
	"scope_value" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"severity_override" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"claim_version_id" uuid,
	"service_line_id" uuid,
	"rule_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"severity" "rule_severity" NOT NULL,
	"message" text NOT NULL,
	"path" text,
	"suggested_fix" jsonb,
	"evidence" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"overridden_by" uuid,
	"override_reason" text,
	"overridden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"plain_language" text,
	"message_template" text NOT NULL,
	"suggested_fix" jsonb,
	"change_note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"severity" "rule_severity" DEFAULT 'error' NOT NULL,
	"status" "rule_status" DEFAULT 'draft' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"active_version_id" uuid,
	"source_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"actor_label" text,
	"verb" text NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_chain_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"from_sequence" text NOT NULL,
	"to_sequence" text NOT NULL,
	"result" text NOT NULL,
	"broken_at_sequence" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" bigserial NOT NULL,
	"org_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"actor_label" text,
	"elevation_id" uuid,
	"action" "audit_action" NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"patient_id" uuid,
	"practice_id" uuid,
	"changes" jsonb,
	"context" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"session_id" uuid,
	"request_id" text,
	"previous_hash" text,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_row_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"table_name" text NOT NULL,
	"row_id" uuid,
	"op" text NOT NULL,
	"changed_columns" text[],
	"old_values" jsonb,
	"new_values" jsonb,
	"actor_user_id" uuid,
	"session_id" uuid,
	"request_id" text,
	"access_context" text
);
--> statement-breakpoint
CREATE TABLE "compliance_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"actor_user_id" uuid,
	"summary" text NOT NULL,
	"evidence" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phi_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"session_id" uuid,
	"request_id" text,
	"elevation_id" uuid,
	"route" text NOT NULL,
	"purpose" text,
	"resource_type" text NOT NULL,
	"patient_ids" uuid[] NOT NULL,
	"record_count" integer NOT NULL,
	"field_classes" text[],
	"is_export" boolean DEFAULT false NOT NULL,
	"ip_address" "inet"
);
--> statement-breakpoint
CREATE TABLE "api_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"practice_ids" uuid[],
	"ip_allowlist" "inet"[],
	"api_version" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"api_client_id" uuid,
	"name" text NOT NULL,
	"public_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"last4" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"practice_ids" uuid[],
	"ip_allowlist" "inet"[],
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_used_ip" "inet",
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"global_paused" boolean DEFAULT false NOT NULL,
	"paused_reason" text,
	"paused_by" uuid,
	"paused_at" timestamp with time zone,
	"auto_eligibility_pre_visit" boolean DEFAULT true NOT NULL,
	"auto_eligibility_pre_visit_days" integer DEFAULT 3 NOT NULL,
	"auto_eligibility_check_in" boolean DEFAULT true NOT NULL,
	"auto_eligibility_monthly" boolean DEFAULT true NOT NULL,
	"auto_claim_status" boolean DEFAULT true NOT NULL,
	"auto_submit_ready_claims" boolean DEFAULT false NOT NULL,
	"auto_submit_hour_utc" integer DEFAULT 13 NOT NULL,
	"auto_secondary_claims" boolean DEFAULT true NOT NULL,
	"auto_submit_secondary" boolean DEFAULT false NOT NULL,
	"secondary_min_balance_cents" bigint DEFAULT 500 NOT NULL,
	"auto_transfer_patient_responsibility" boolean DEFAULT true NOT NULL,
	"auto_corrected_claims" boolean DEFAULT false NOT NULL,
	"auto_corrected_claim_allowlist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"daily_budget_cents" bigint DEFAULT 50000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"patient_id" uuid,
	"claim_id" uuid,
	"encounter_id" uuid,
	"remittance_id" uuid,
	"denial_id" uuid,
	"task_id" uuid,
	"statement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"storage_key" text NOT NULL,
	"bucket" text NOT NULL,
	"display_name" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"kind" text NOT NULL,
	"retention_class" text DEFAULT 'standard' NOT NULL,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"practice_id" uuid,
	"connector" text NOT NULL,
	"operation" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"http_status" integer,
	"outcome" text NOT NULL,
	"cost_cents" bigint DEFAULT 0 NOT NULL,
	"triggered_by" text,
	"error_class" text
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"client_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"request_hash" text NOT NULL,
	"state" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "report_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"contains_phi" boolean DEFAULT false NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"source_prompt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"schedule_id" uuid,
	"requested_by" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"row_count" integer,
	"duration_ms" integer,
	"document_id" uuid,
	"download_expires_at" timestamp with time zone,
	"download_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"cron" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"format" text DEFAULT 'xlsx' NOT NULL,
	"recipient_user_ids" uuid[] NOT NULL,
	"filters_override" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload_hash" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"http_status" integer,
	"response_snippet" text,
	"duration_ms" integer,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"secret_encrypted" text NOT NULL,
	"previous_secret_encrypted" text,
	"secret_rotated_at" timestamp with time zone,
	"event_types" text[] NOT NULL,
	"api_version" text NOT NULL,
	"payload_mode" text DEFAULT 'full' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "add_on_code_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"add_on_code" text NOT NULL,
	"primary_code" text NOT NULL,
	"add_on_type" text DEFAULT '1' NOT NULL,
	"effective_date" date NOT NULL,
	"deletion_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustment_reason_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_type" text NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"denial_category" text,
	"suggested_action" text,
	"is_denial" boolean DEFAULT false NOT NULL,
	"auto_resolvable" boolean DEFAULT false NOT NULL,
	"effective_date" date,
	"deactivated_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_set_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_set" text NOT NULL,
	"version" text NOT NULL,
	"effective_date" date NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"source_url" text,
	"checksum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_type" text NOT NULL,
	"policy_id" text NOT NULL,
	"title" text NOT NULL,
	"mac_jurisdiction" text,
	"payer_id" text,
	"effective_date" date NOT NULL,
	"termination_date" date,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_policy_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" text NOT NULL,
	"procedure_code" text NOT NULL,
	"diagnosis_code" text NOT NULL,
	"relationship" text DEFAULT 'supports' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnosis_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"short_description" text,
	"billable" boolean DEFAULT true NOT NULL,
	"valid_as_principal" boolean DEFAULT true NOT NULL,
	"sex_restriction" text,
	"age_min" integer,
	"age_max" integer,
	"effective_date" date NOT NULL,
	"termination_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mue_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edit_set" text DEFAULT 'practitioner' NOT NULL,
	"code" text NOT NULL,
	"max_units" integer NOT NULL,
	"mai" text NOT NULL,
	"rationale" text,
	"effective_date" date NOT NULL,
	"deletion_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ncci_ptp_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edit_set" text DEFAULT 'practitioner' NOT NULL,
	"column_one_code" text NOT NULL,
	"column_two_code" text NOT NULL,
	"modifier_indicator" text NOT NULL,
	"effective_date" date NOT NULL,
	"deletion_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_of_service_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"facility_rate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedure_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"code_system" text NOT NULL,
	"description" text,
	"short_description" text,
	"is_add_on" boolean DEFAULT false NOT NULL,
	"modifier_51_exempt" boolean DEFAULT false NOT NULL,
	"global_days" text,
	"allowed_places_of_service" text[],
	"bilateral_indicator" text,
	"assistant_surgeon_indicator" text,
	"multiple_procedure_indicator" text,
	"effective_date" date NOT NULL,
	"termination_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "locations_practice_idx" ON "locations" USING btree ("org_id","practice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "practices_org_idx" ON "practices" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "practices_org_npi_key" ON "practices" USING btree ("org_id","npi");--> statement-breakpoint
CREATE INDEX "provider_enrollments_lookup_idx" ON "provider_enrollments" USING btree ("org_id","provider_id","payer_id");--> statement-breakpoint
CREATE INDEX "provider_enrollments_payer_idx" ON "provider_enrollments" USING btree ("org_id","payer_id");--> statement-breakpoint
CREATE INDEX "providers_practice_idx" ON "providers" USING btree ("org_id","practice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "providers_org_npi_key" ON "providers" USING btree ("org_id","npi");--> statement-breakpoint
CREATE INDEX "access_elevations_active_idx" ON "access_elevations" USING btree ("org_id","user_id","expires_at");--> statement-breakpoint
CREATE INDEX "mfa_methods_user_idx" ON "mfa_methods" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_methods_credential_key" ON "mfa_methods" USING btree ("credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_key" ON "role_permissions" USING btree ("role_id","resource","action");--> statement-breakpoint
CREATE INDEX "role_permissions_org_idx" ON "role_permissions" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_name_key" ON "roles" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_practice_access_key" ON "user_practice_access" USING btree ("user_id","practice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_key" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_org_email_key" ON "users" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "users_org_status_idx" ON "users" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "guarantors_patient_idx" ON "guarantors" USING btree ("org_id","patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_match_pair_key" ON "patient_match_candidates" USING btree ("patient_id","candidate_patient_id");--> statement-breakpoint
CREATE INDEX "patient_match_status_idx" ON "patient_match_candidates" USING btree ("org_id","status","score");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_practice_mrn_key" ON "patients" USING btree ("org_id","practice_id","mrn");--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("org_id","practice_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "patients_dob_idx" ON "patients" USING btree ("org_id","date_of_birth");--> statement-breakpoint
CREATE INDEX "patients_active_idx" ON "patients" USING btree ("org_id","practice_id","merged_into_patient_id");--> statement-breakpoint
CREATE INDEX "fee_schedule_lines_lookup_idx" ON "fee_schedule_lines" USING btree ("org_id","fee_schedule_id","procedure_code");--> statement-breakpoint
CREATE INDEX "fee_schedules_contract_idx" ON "fee_schedules" USING btree ("org_id","contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payer_behavior_key" ON "payer_behavior_stats" USING btree ("org_id","payer_id","practice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payer_connector_key" ON "payer_connector_ids" USING btree ("payer_id","connector");--> statement-breakpoint
CREATE INDEX "payer_contracts_lookup_idx" ON "payer_contracts" USING btree ("org_id","practice_id","payer_id");--> statement-breakpoint
CREATE INDEX "payer_contracts_effective_idx" ON "payer_contracts" USING btree ("org_id","effective_date","termination_date");--> statement-breakpoint
CREATE INDEX "payer_plans_payer_idx" ON "payer_plans" USING btree ("org_id","payer_id");--> statement-breakpoint
CREATE INDEX "payers_org_idx" ON "payers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "payers_name_idx" ON "payers" USING btree ("org_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "coverage_case_details_coverage_key" ON "coverage_case_details" USING btree ("coverage_id");--> statement-breakpoint
CREATE INDEX "coverages_patient_idx" ON "coverages" USING btree ("org_id","patient_id","rank");--> statement-breakpoint
CREATE INDEX "coverages_payer_idx" ON "coverages" USING btree ("org_id","payer_id");--> statement-breakpoint
CREATE INDEX "coverages_verification_idx" ON "coverages" USING btree ("org_id","active","last_verified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coverages_patient_rank_active_key" ON "coverages" USING btree ("patient_id","rank") WHERE active = true;--> statement-breakpoint
CREATE INDEX "eligibility_batches_practice_idx" ON "eligibility_batches" USING btree ("org_id","practice_id","created_at");--> statement-breakpoint
CREATE INDEX "eligibility_batches_status_idx" ON "eligibility_batches" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "eligibility_benefits_check_idx" ON "eligibility_benefits" USING btree ("org_id","eligibility_check_id");--> statement-breakpoint
CREATE INDEX "eligibility_benefits_type_idx" ON "eligibility_benefits" USING btree ("eligibility_check_id","service_type_code","benefit_code");--> statement-breakpoint
CREATE INDEX "eligibility_checks_patient_idx" ON "eligibility_checks" USING btree ("org_id","patient_id","created_at");--> statement-breakpoint
CREATE INDEX "eligibility_checks_coverage_idx" ON "eligibility_checks" USING btree ("org_id","coverage_id","created_at");--> statement-breakpoint
CREATE INDEX "eligibility_checks_batch_idx" ON "eligibility_checks" USING btree ("org_id","batch_id");--> statement-breakpoint
CREATE INDEX "eligibility_checks_status_idx" ON "eligibility_checks" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "encounters_practice_number_key" ON "encounters" USING btree ("org_id","practice_id","encounter_number");--> statement-breakpoint
CREATE INDEX "encounters_patient_idx" ON "encounters" USING btree ("org_id","patient_id","service_date");--> statement-breakpoint
CREATE INDEX "encounters_status_idx" ON "encounters" USING btree ("org_id","practice_id","status");--> statement-breakpoint
CREATE INDEX "encounters_service_date_idx" ON "encounters" USING btree ("org_id","service_date");--> statement-breakpoint
CREATE UNIQUE INDEX "service_lines_encounter_line_key" ON "service_lines" USING btree ("encounter_id","line_number");--> statement-breakpoint
CREATE INDEX "service_lines_encounter_idx" ON "service_lines" USING btree ("org_id","encounter_id");--> statement-breakpoint
CREATE INDEX "service_lines_procedure_idx" ON "service_lines" USING btree ("org_id","procedure_code","service_date");--> statement-breakpoint
CREATE INDEX "claim_acknowledgments_claim_idx" ON "claim_acknowledgments" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE INDEX "claim_acknowledgments_unresolved_idx" ON "claim_acknowledgments" USING btree ("org_id","result_code","resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_custom_statuses_org_label_key" ON "claim_custom_statuses" USING btree ("org_id","practice_id","label");--> statement-breakpoint
CREATE INDEX "claim_custom_statuses_org_idx" ON "claim_custom_statuses" USING btree ("org_id","practice_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_line_prior_adjudications_key" ON "claim_line_prior_adjudications" USING btree ("service_line_id","prior_payer_id");--> statement-breakpoint
CREATE INDEX "claim_line_prior_adjudications_claim_idx" ON "claim_line_prior_adjudications" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE INDEX "claim_state_transitions_claim_idx" ON "claim_state_transitions" USING btree ("org_id","claim_id","occurred_at");--> statement-breakpoint
CREATE INDEX "claim_status_checks_claim_idx" ON "claim_status_checks" USING btree ("org_id","claim_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_submissions_attempt_key" ON "claim_submissions" USING btree ("claim_id","attempt_number");--> statement-breakpoint
CREATE INDEX "claim_submissions_claim_idx" ON "claim_submissions" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE INDEX "claim_submissions_connector_idx" ON "claim_submissions" USING btree ("org_id","connector_submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_versions_key" ON "claim_versions" USING btree ("claim_id","version_number");--> statement-breakpoint
CREATE INDEX "claim_versions_claim_idx" ON "claim_versions" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_org_number_key" ON "claims" USING btree ("org_id","claim_number");--> statement-breakpoint
CREATE INDEX "claims_status_idx" ON "claims" USING btree ("org_id","practice_id","status");--> statement-breakpoint
CREATE INDEX "claims_custom_status_idx" ON "claims" USING btree ("org_id","custom_status_id");--> statement-breakpoint
CREATE INDEX "claims_patient_idx" ON "claims" USING btree ("org_id","patient_id");--> statement-breakpoint
CREATE INDEX "claims_encounter_idx" ON "claims" USING btree ("org_id","encounter_id");--> statement-breakpoint
CREATE INDEX "claims_payer_status_idx" ON "claims" USING btree ("org_id","payer_id","status");--> statement-breakpoint
CREATE INDEX "claims_timely_filing_idx" ON "claims" USING btree ("org_id","status","timely_filing_deadline");--> statement-breakpoint
CREATE INDEX "claims_balance_idx" ON "claims" USING btree ("org_id","practice_id","balance_cents");--> statement-breakpoint
CREATE INDEX "payer_formatter_overrides_payer_idx" ON "payer_formatter_overrides" USING btree ("org_id","payer_id","active");--> statement-breakpoint
CREATE INDEX "denials_status_idx" ON "denials" USING btree ("org_id","practice_id","status");--> statement-breakpoint
CREATE INDEX "denials_category_idx" ON "denials" USING btree ("org_id","category","created_at");--> statement-breakpoint
CREATE INDEX "denials_payer_idx" ON "denials" USING btree ("org_id","payer_id","reason_code");--> statement-breakpoint
CREATE INDEX "denials_assigned_idx" ON "denials" USING btree ("org_id","assigned_to","status");--> statement-breakpoint
CREATE INDEX "denials_deadline_idx" ON "denials" USING btree ("org_id","status","appeal_deadline");--> statement-breakpoint
CREATE INDEX "provider_level_adjustments_remittance_idx" ON "provider_level_adjustments" USING btree ("org_id","remittance_id");--> statement-breakpoint
CREATE INDEX "remittance_adjustments_claim_idx" ON "remittance_adjustments" USING btree ("org_id","remittance_claim_id");--> statement-breakpoint
CREATE INDEX "remittance_adjustments_line_idx" ON "remittance_adjustments" USING btree ("org_id","remittance_line_id");--> statement-breakpoint
CREATE INDEX "remittance_adjustments_reason_idx" ON "remittance_adjustments" USING btree ("org_id","group_code","reason_code");--> statement-breakpoint
CREATE INDEX "remittance_claims_remittance_idx" ON "remittance_claims" USING btree ("org_id","remittance_id");--> statement-breakpoint
CREATE INDEX "remittance_claims_claim_idx" ON "remittance_claims" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE INDEX "remittance_claims_unmatched_idx" ON "remittance_claims" USING btree ("org_id","claim_id","patient_control_number");--> statement-breakpoint
CREATE INDEX "remittance_lines_claim_idx" ON "remittance_lines" USING btree ("org_id","remittance_claim_id");--> statement-breakpoint
CREATE INDEX "remittance_lines_service_line_idx" ON "remittance_lines" USING btree ("org_id","service_line_id");--> statement-breakpoint
CREATE INDEX "remittance_lines_underpayment_idx" ON "remittance_lines" USING btree ("org_id","underpayment_cents");--> statement-breakpoint
CREATE INDEX "remittances_org_status_idx" ON "remittances" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "remittances_payment_date_idx" ON "remittances" USING btree ("org_id","payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "remittances_trace_key" ON "remittances" USING btree ("org_id","trace_number","payer_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "balance_snapshots_subject_key" ON "balance_snapshots" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "balance_snapshots_variance_idx" ON "balance_snapshots" USING btree ("org_id","reconciliation_variance_cents");--> statement-breakpoint
CREATE INDEX "ledger_entries_claim_idx" ON "ledger_entries" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_patient_idx" ON "ledger_entries" USING btree ("org_id","patient_id","responsibility");--> statement-breakpoint
CREATE INDEX "ledger_entries_posting_idx" ON "ledger_entries" USING btree ("org_id","practice_id","posting_date");--> statement-breakpoint
CREATE INDEX "ledger_entries_service_line_idx" ON "ledger_entries" USING btree ("org_id","service_line_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_source_idx" ON "ledger_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "dunning_policies_practice_idx" ON "dunning_policies" USING btree ("org_id","practice_id");--> statement-breakpoint
CREATE INDEX "patient_payment_methods_patient_idx" ON "patient_payment_methods" USING btree ("org_id","patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_payment_methods_stripe_key" ON "patient_payment_methods" USING btree ("stripe_payment_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_statements_number_key" ON "patient_statements" USING btree ("org_id","statement_number");--> statement-breakpoint
CREATE INDEX "patient_statements_patient_idx" ON "patient_statements" USING btree ("org_id","patient_id","statement_date");--> statement-breakpoint
CREATE INDEX "patient_statements_status_idx" ON "patient_statements" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_statements_pay_link_key" ON "patient_statements" USING btree ("pay_link_token");--> statement-breakpoint
CREATE INDEX "payment_applications_payment_idx" ON "payment_applications" USING btree ("org_id","payment_id");--> statement-breakpoint
CREATE INDEX "payment_applications_line_idx" ON "payment_applications" USING btree ("org_id","service_line_id");--> statement-breakpoint
CREATE INDEX "payment_batches_practice_idx" ON "payment_batches" USING btree ("org_id","practice_id","deposit_date");--> statement-breakpoint
CREATE INDEX "payment_plans_next_charge_idx" ON "payment_plans" USING btree ("org_id","status","next_charge_date");--> statement-breakpoint
CREATE INDEX "payments_batch_idx" ON "payments" USING btree ("org_id","payment_batch_id");--> statement-breakpoint
CREATE INDEX "payments_patient_idx" ON "payments" USING btree ("org_id","patient_id","received_date");--> statement-breakpoint
CREATE INDEX "payments_unapplied_idx" ON "payments" USING btree ("org_id","unapplied_cents");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_stripe_intent_key" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "statement_lines_statement_idx" ON "statement_lines" USING btree ("org_id","statement_id");--> statement-breakpoint
CREATE INDEX "statement_runs_practice_idx" ON "statement_runs" USING btree ("org_id","practice_id","run_date");--> statement-breakpoint
CREATE INDEX "saved_views_owner_idx" ON "saved_views" USING btree ("org_id","owner_user_id","dataset");--> statement-breakpoint
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("org_id","task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_events_task_idx" ON "task_events" USING btree ("org_id","task_id","occurred_at");--> statement-breakpoint
CREATE INDEX "tasks_queue_status_idx" ON "tasks" USING btree ("org_id","work_queue_id","status");--> statement-breakpoint
CREATE INDEX "tasks_assigned_idx" ON "tasks" USING btree ("org_id","assigned_to","status");--> statement-breakpoint
CREATE INDEX "tasks_subject_idx" ON "tasks" USING btree ("org_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("org_id","status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_dedupe_key" ON "tasks" USING btree ("org_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "work_queues_org_key" ON "work_queues" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "rule_backtests_version_idx" ON "rule_backtests" USING btree ("org_id","rule_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_bindings_key" ON "rule_bindings" USING btree ("rule_id","scope_type","scope_value");--> statement-breakpoint
CREATE INDEX "rule_bindings_scope_idx" ON "rule_bindings" USING btree ("org_id","scope_type","scope_value");--> statement-breakpoint
CREATE INDEX "rule_findings_claim_idx" ON "rule_findings" USING btree ("org_id","claim_id","status");--> statement-breakpoint
CREATE INDEX "rule_findings_rule_idx" ON "rule_findings" USING btree ("org_id","rule_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_versions_key" ON "rule_versions" USING btree ("rule_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "rules_org_key" ON "rules" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "rules_status_idx" ON "rules" USING btree ("org_id","status","category");--> statement-breakpoint
CREATE INDEX "activity_events_subject_idx" ON "activity_events" USING btree ("org_id","subject_type","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activity_events_actor_idx" ON "activity_events" USING btree ("org_id","actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_chain_verifications_org_idx" ON "audit_chain_verifications" USING btree ("org_id","checked_at");--> statement-breakpoint
CREATE INDEX "audit_events_org_time_idx" ON "audit_events" USING btree ("org_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("org_id","actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("org_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_events_patient_idx" ON "audit_events" USING btree ("org_id","patient_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_sequence_idx" ON "audit_events" USING btree ("sequence");--> statement-breakpoint
CREATE INDEX "audit_row_changes_row_idx" ON "audit_row_changes" USING btree ("org_id","table_name","row_id");--> statement-breakpoint
CREATE INDEX "audit_row_changes_time_idx" ON "audit_row_changes" USING btree ("org_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_row_changes_actor_idx" ON "audit_row_changes" USING btree ("org_id","actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "compliance_alerts_status_idx" ON "compliance_alerts" USING btree ("org_id","status","created_at");--> statement-breakpoint
CREATE INDEX "phi_access_events_actor_idx" ON "phi_access_events" USING btree ("org_id","actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "phi_access_events_time_idx" ON "phi_access_events" USING btree ("org_id","occurred_at");--> statement-breakpoint
CREATE INDEX "phi_access_events_export_idx" ON "phi_access_events" USING btree ("org_id","is_export","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_clients_client_id_key" ON "api_clients" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_public_id_key" ON "api_keys" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_settings_key" ON "automation_settings" USING btree ("org_id","practice_id");--> statement-breakpoint
CREATE INDEX "document_links_document_idx" ON "document_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_links_patient_idx" ON "document_links" USING btree ("org_id","patient_id");--> statement-breakpoint
CREATE INDEX "document_links_claim_idx" ON "document_links" USING btree ("org_id","claim_id");--> statement-breakpoint
CREATE INDEX "documents_org_kind_idx" ON "documents" USING btree ("org_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "external_calls_budget_idx" ON "external_calls" USING btree ("org_id","started_at","connector");--> statement-breakpoint
CREATE INDEX "external_calls_subject_idx" ON "external_calls" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_key" ON "idempotency_records" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "idempotency_records_expiry_idx" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events" USING btree ("published_at","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_events_idempotency_key" ON "outbox_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "report_definitions_owner_idx" ON "report_definitions" USING btree ("org_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "report_runs_report_idx" ON "report_runs" USING btree ("org_id","report_id","created_at");--> statement-breakpoint
CREATE INDEX "report_schedules_next_run_idx" ON "report_schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_pending_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_endpoint_idx" ON "webhook_deliveries" USING btree ("org_id","endpoint_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_org_idx" ON "webhook_endpoints" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "add_on_code_key" ON "add_on_code_edits" USING btree ("add_on_code","primary_code","effective_date");--> statement-breakpoint
CREATE INDEX "add_on_code_lookup_idx" ON "add_on_code_edits" USING btree ("add_on_code");--> statement-breakpoint
CREATE UNIQUE INDEX "adjustment_reason_codes_key" ON "adjustment_reason_codes" USING btree ("code_type","code");--> statement-breakpoint
CREATE UNIQUE INDEX "code_set_versions_key" ON "code_set_versions" USING btree ("code_set","version");--> statement-breakpoint
CREATE UNIQUE INDEX "coverage_policies_key" ON "coverage_policies" USING btree ("policy_type","policy_id","mac_jurisdiction");--> statement-breakpoint
CREATE INDEX "coverage_policies_jurisdiction_idx" ON "coverage_policies" USING btree ("mac_jurisdiction","policy_type");--> statement-breakpoint
CREATE INDEX "coverage_policy_codes_lookup_idx" ON "coverage_policy_codes" USING btree ("procedure_code","diagnosis_code");--> statement-breakpoint
CREATE UNIQUE INDEX "coverage_policy_codes_key" ON "coverage_policy_codes" USING btree ("policy_id","procedure_code","diagnosis_code");--> statement-breakpoint
CREATE UNIQUE INDEX "diagnosis_codes_code_key" ON "diagnosis_codes" USING btree ("code","effective_date");--> statement-breakpoint
CREATE INDEX "diagnosis_codes_search_idx" ON "diagnosis_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "mue_edits_key" ON "mue_edits" USING btree ("edit_set","code","effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ncci_ptp_key" ON "ncci_ptp_edits" USING btree ("edit_set","column_one_code","column_two_code","effective_date");--> statement-breakpoint
CREATE INDEX "ncci_ptp_lookup_idx" ON "ncci_ptp_edits" USING btree ("edit_set","column_two_code","column_one_code");--> statement-breakpoint
CREATE UNIQUE INDEX "place_of_service_codes_key" ON "place_of_service_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "procedure_codes_key" ON "procedure_codes" USING btree ("code","code_system","effective_date");