ALTER TABLE "tenant_members" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "features" SET DEFAULT '{"configurableDashboards":false,"webhookSync":false,"whiteLabel":false,"apiAccess":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD COLUMN "invitation_token_hash" text;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD COLUMN "invitation_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;