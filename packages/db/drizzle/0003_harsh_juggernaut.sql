ALTER TABLE "tenant_subscriptions" ADD COLUMN "scheduled_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD COLUMN "stripe_subscription_schedule_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_scheduled_plan_id_plans_id_fk" FOREIGN KEY ("scheduled_plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;