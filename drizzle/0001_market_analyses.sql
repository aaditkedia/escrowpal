CREATE TABLE "market_analyses" (
 "id" text PRIMARY KEY NOT NULL,
 "access_token" text NOT NULL,
 "input" jsonb NOT NULL,
 "result" jsonb NOT NULL,
 "digest" text NOT NULL,
 "selected_option_id" text,
 "status" text DEFAULT 'ready' NOT NULL,
 "deal_id" text REFERENCES "deals"("id"),
 "created_at" timestamp DEFAULT now() NOT NULL
);
