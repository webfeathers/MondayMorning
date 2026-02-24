/**
 * Test script for AI execution flow.
 * This script creates a test execution and monitors it.
 */

import { db } from '@wf/db';
import { aiExecutions, aiExecutionJobs, tenants, users } from '@wf/db';
import { eq } from 'drizzle-orm';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function testExecutionFlow() {
  console.log('🧪 Testing AI Execution Flow...\n');

  try {
    // 1. Find or create a test tenant and user
    console.log('1️⃣  Finding test tenant and user...');
    const testTenant = await db.query.tenants.findFirst({
      limit: 1,
    });

    if (!testTenant) {
      console.error('❌ No tenant found. Please run seed script first.');
      process.exit(1);
    }

    const testUser = await db.query.users.findFirst({
      limit: 1,
    });

    if (!testUser) {
      console.error('❌ No user found. Please run seed script first.');
      process.exit(1);
    }

    console.log(`   ✅ Tenant: ${testTenant.name} (${testTenant.id})`);
    console.log(`   ✅ User: ${testUser.email} (${testUser.id})\n`);

    // 2. Create a test execution
    console.log('2️⃣  Creating test execution...');
    const [execution] = await db
      .insert(aiExecutions)
      .values({
        tenantId: testTenant.id,
        userId: testUser.id,
        crewTemplateId: 'account_health',
        entityType: 'account',
        entityId: 'test-account-123',
        status: 'pending',
        contextData: {
          accounts: [],
          deals: [],
          contacts: [],
          tickets: [],
        },
        metadata: {
          test: true,
          recordCounts: {
            accounts: 0,
            deals: 0,
            contacts: 0,
            tickets: 0,
          },
        },
      })
      .returning();

    console.log(`   ✅ Execution created: ${execution.id}\n`);

    // 3. Create a job for the execution
    console.log('3️⃣  Creating job for worker...');
    const [job] = await db
      .insert(aiExecutionJobs)
      .values({
        tenantId: testTenant.id,
        executionId: execution.id,
        status: 'pending',
        priority: 10, // High priority for test
      })
      .returning();

    console.log(`   ✅ Job created: ${job.id}\n`);

    // 4. Check AI service health
    console.log('4️⃣  Checking AI service health...');
    try {
      const healthResponse = await fetch(`${AI_SERVICE_URL}/health`);
      if (healthResponse.ok) {
        console.log(`   ✅ AI service is healthy at ${AI_SERVICE_URL}\n`);
      } else {
        console.log(`   ⚠️  AI service returned ${healthResponse.status}\n`);
      }
    } catch (error) {
      console.log(`   ⚠️  AI service not reachable at ${AI_SERVICE_URL}`);
      console.log(`   💡 Start it with: cd apps/ai-service && python -m uvicorn src.main:app --reload\n`);
    }

    // 5. Monitor the job
    console.log('5️⃣  Monitoring job status...');
    console.log('   💡 Make sure worker is running: pnpm --filter @wf/web worker\n');

    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const updatedJob = await db.query.aiExecutionJobs.findFirst({
        where: eq(aiExecutionJobs.id, job.id),
      });

      const updatedExecution = await db.query.aiExecutions.findFirst({
        where: eq(aiExecutions.id, execution.id),
      });

      console.log(
        `   [${i * 2}s] Job: ${updatedJob?.status}, Execution: ${updatedExecution?.status}`
      );

      if (updatedJob?.status === 'completed' || updatedJob?.status === 'failed') {
        console.log(`\n   ✅ Job ${updatedJob.status}!\n`);

        if (updatedExecution?.status === 'completed') {
          console.log('6️⃣  Execution Results:');
          console.log('   Status:', updatedExecution.status);
          console.log('   Credits consumed:', updatedExecution.creditsConsumed);
          console.log('   Execution time:', updatedExecution.executionTimeSeconds, 's');
          console.log('   Model:', updatedExecution.modelName);
          if (updatedExecution.result) {
            console.log('   Result:', JSON.stringify(updatedExecution.result, null, 2));
          }
        } else if (updatedExecution?.status === 'failed') {
          console.log('6️⃣  Execution Failed:');
          console.log('   Error:', updatedExecution.errorMessage);
        }

        break;
      }

      if (i === 29) {
        console.log('\n   ⏰ Timeout waiting for job to complete.');
        console.log('   Check that worker is running and AI service is accessible.');
      }
    }

    console.log('\n✅ Test completed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testExecutionFlow();
