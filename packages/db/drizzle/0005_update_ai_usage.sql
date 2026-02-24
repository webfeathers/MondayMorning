-- Update ai_usage table for comprehensive usage tracking

-- Drop old foreign key constraint to crew_templates
ALTER TABLE "ai_usage" DROP CONSTRAINT IF EXISTS "ai_usage_crew_template_id_crew_templates_id_fk";

-- Drop old columns
ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "job_id";
ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "model";
ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "input_tokens";
ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "output_tokens";
ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "credits_used";
ALTER TABLE "ai_usage" DROP COLUMN IF EXISTS "execution_time_ms";

-- Alter crew_template_id to text instead of uuid
ALTER TABLE "ai_usage" ALTER COLUMN "crew_template_id" DROP NOT NULL;
ALTER TABLE "ai_usage" ALTER COLUMN "crew_template_id" TYPE text USING crew_template_id::text;
ALTER TABLE "ai_usage" ALTER COLUMN "crew_template_id" SET NOT NULL;

-- Add new columns
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "execution_id" uuid REFERENCES "public"."ai_executions"("id") ON DELETE SET NULL;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "entity_type" text;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "entity_id" text;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "model_name" text NOT NULL DEFAULT 'unknown';
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "prompt_tokens" integer NOT NULL DEFAULT 0;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "completion_tokens" integer NOT NULL DEFAULT 0;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "total_tokens" integer NOT NULL DEFAULT 0;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "estimated_cost_usd" numeric(10, 6);
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "credits_consumed" integer NOT NULL DEFAULT 0;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "execution_time_seconds" integer;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'completed';
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_ai_usage_tenant_id" ON "ai_usage"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_user_id" ON "ai_usage"("user_id");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_execution_id" ON "ai_usage"("execution_id");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_created_at" ON "ai_usage"("created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_tenant_created" ON "ai_usage"("tenant_id", "created_at" DESC);

-- Remove default from model_name after setting it for existing rows
ALTER TABLE "ai_usage" ALTER COLUMN "model_name" DROP DEFAULT;
