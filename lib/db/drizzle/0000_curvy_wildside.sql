CREATE TABLE "agency_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"full_name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_day_of_week" integer DEFAULT 4 NOT NULL,
	"report_hour" integer DEFAULT 17 NOT NULL,
	"report_minute" integer DEFAULT 0 NOT NULL,
	"recipients" text DEFAULT 'rauni@crmgrp.com,chad@crmgrp.com' NOT NULL,
	"commission_rates" jsonb NOT NULL,
	"commission_table" jsonb,
	"logo_path" text,
	"brand_color" text DEFAULT '#0d9488',
	"panel_color" text DEFAULT '#0f172a',
	"brand_name" text DEFAULT 'CRM Group Insurance',
	"carrier_colors" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_name" text NOT NULL,
	"contact_type" varchar(50) NOT NULL,
	"call_date" date NOT NULL,
	"notes" text,
	"week_start" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_source_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_source_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"paid_date" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" varchar(255) NOT NULL,
	"cost_per_lead" double precision DEFAULT 0,
	"total_invested" double precision DEFAULT 0,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255),
	"phone" varchar(50),
	"email" varchar(255),
	"lead_ownership" varchar(50),
	"lead_source_id" integer,
	"state" varchar(100),
	"county" varchar(100),
	"zip" varchar(20),
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"revenue" double precision,
	"carrier" varchar(255),
	"sales_type" varchar(255),
	"commission_type" varchar(255),
	"cost_per_lead" double precision,
	"line_of_business" varchar(50) DEFAULT 'medicare' NOT NULL,
	"ancillary_type" varchar(100),
	"marketplace" varchar(10),
	"household_count" integer,
	"qualified" varchar(10),
	"principal" double precision,
	"face_value" double precision,
	"notes" text,
	"entered_date" text NOT NULL,
	"sold_date" text,
	"linked_sale_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"clerk_invitation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_invites_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"client_name" text NOT NULL,
	"owning_agent" text,
	"sales_source" text,
	"sales_type" text NOT NULL,
	"sold_date" text NOT NULL,
	"effective_date" text,
	"commission_type" text NOT NULL,
	"lead_source" text,
	"hra" double precision,
	"estimated_commission" double precision,
	"notes" text,
	"line_of_business" varchar(50) DEFAULT 'medicare' NOT NULL,
	"carrier" varchar(255),
	"metal_tier" varchar(50),
	"household_size" integer,
	"product_type" varchar(50),
	"paid" boolean DEFAULT false NOT NULL,
	"week_start" text NOT NULL,
	"lead_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" text NOT NULL,
	"week_end" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_sales" integer DEFAULT 0 NOT NULL,
	"total_estimated_commission" double precision DEFAULT 0 NOT NULL,
	"recipients" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_source_payments" ADD CONSTRAINT "lead_source_payments_lead_source_id_lead_sources_id_fk" FOREIGN KEY ("lead_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_lead_source_id_lead_sources_id_fk" FOREIGN KEY ("lead_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE set null ON UPDATE no action;