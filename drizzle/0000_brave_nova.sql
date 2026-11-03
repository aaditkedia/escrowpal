CREATE TABLE "deals" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'awaiting_seller' NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text,
	"seller_name" text NOT NULL,
	"seller_email" text,
	"buyer_token" text NOT NULL,
	"seller_token" text NOT NULL,
	"buyer_signed_at" timestamp,
	"seller_signed_at" timestamp,
	"inspection_days" integer DEFAULT 3 NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"risk" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engine" text DEFAULT 'local' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"milestone_id" text NOT NULL,
	"opened_by" text NOT NULL,
	"reason" text NOT NULL,
	"seller_response" text,
	"buyer_response" text,
	"mediator" jsonb,
	"resolution" text,
	"buyer_accepts" integer,
	"seller_accepts" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"milestone_id" text NOT NULL,
	"role" text NOT NULL,
	"note" text NOT NULL,
	"file_name" text,
	"file_type" text,
	"file_size" integer,
	"file_data" "bytea",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"idx" integer NOT NULL,
	"title" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"criteria" jsonb NOT NULL,
	"due_date" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"auth_id" text,
	"order_id" text,
	"capture_id" text,
	"released_amount" numeric(12, 2),
	"submitted_at" timestamp,
	"verdict" jsonb
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;