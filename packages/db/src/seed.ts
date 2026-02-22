import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('🌱 Starting database seed...');
  console.log(`📍 Connecting to database...`);

  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });

  try {
    // Seed default plans
    console.log('\n📦 Seeding plans...');
    await db
      .insert(schema.plans)
      .values([
        {
          slug: 'starter',
          name: 'Starter',
          monthlyCredits: 50,
          maxUsers: 5,
          allowedModels: ['gemini-2.0-flash'],
          allowedIntegrationTypes: ['crm'],
          features: {
            configurableDashboards: false,
            webhookSync: false,
            whiteLabel: false,
            apiAccess: false,
          },
          pricePerSeatMonthly: '29',
          sortOrder: 1,
          isActive: true,
        },
        {
          slug: 'pro',
          name: 'Pro',
          monthlyCredits: 500,
          maxUsers: 50,
          allowedModels: ['claude-sonnet-4-20250514', 'gemini-2.0-flash'],
          allowedIntegrationTypes: ['crm', 'meeting', 'ticketing'],
          features: {
            configurableDashboards: true,
            webhookSync: true,
            whiteLabel: false,
            apiAccess: false,
          },
          pricePerSeatMonthly: '79',
          sortOrder: 2,
          isActive: true,
        },
        {
          slug: 'enterprise',
          name: 'Enterprise',
          monthlyCredits: null, // unlimited
          maxUsers: null, // unlimited
          allowedModels: [
            'claude-opus-4-20250514',
            'claude-sonnet-4-20250514',
            'gemini-2.0-flash',
          ],
          allowedIntegrationTypes: [
            'crm',
            'meeting',
            'ticketing',
            'project',
            'enrichment',
          ],
          features: {
            configurableDashboards: true,
            webhookSync: true,
            whiteLabel: true,
            apiAccess: true,
          },
          pricePerSeatMonthly: '149',
          sortOrder: 3,
          isActive: true,
        },
      ])
      .onConflictDoNothing();

    console.log('✅ Plans seeded (starter, pro, enterprise)');

    // Seed default permissions
    console.log('\n🔒 Seeding default permissions...');
    await db
      .insert(schema.permissions)
      .values([
        // Dashboard permissions
        {
          resource: 'dashboard',
          action: 'view',
          description: 'View dashboard and analytics',
          requiredRole: 'member',
        },
        {
          resource: 'dashboard',
          action: 'configure',
          description: 'Configure dashboard widgets and layouts',
          requiredRole: 'admin',
        },

        // Settings permissions
        {
          resource: 'settings',
          action: 'view',
          description: 'View tenant settings',
          requiredRole: 'member',
        },
        {
          resource: 'settings',
          action: 'update',
          description: 'Update tenant settings',
          requiredRole: 'admin',
        },

        // Crew permissions
        {
          resource: 'crew',
          action: 'view',
          description: 'View crew templates and results',
          requiredRole: 'member',
        },
        {
          resource: 'crew',
          action: 'execute',
          description: 'Execute crew analyses',
          requiredRole: 'member',
        },
        {
          resource: 'crew',
          action: 'configure',
          description: 'Configure and override crew templates',
          requiredRole: 'admin',
        },

        // Integration permissions
        {
          resource: 'integrations',
          action: 'view',
          description: 'View connected integrations',
          requiredRole: 'member',
        },
        {
          resource: 'integrations',
          action: 'connect',
          description: 'Connect new integrations',
          requiredRole: 'admin',
        },
        {
          resource: 'integrations',
          action: 'disconnect',
          description: 'Disconnect integrations',
          requiredRole: 'admin',
        },
        {
          resource: 'integrations',
          action: 'sync',
          description: 'Trigger manual sync',
          requiredRole: 'admin',
        },

        // Member permissions
        {
          resource: 'members',
          action: 'view',
          description: 'View team members',
          requiredRole: 'member',
        },
        {
          resource: 'members',
          action: 'invite',
          description: 'Invite new team members',
          requiredRole: 'admin',
        },
        {
          resource: 'members',
          action: 'remove',
          description: 'Remove team members',
          requiredRole: 'admin',
        },
        {
          resource: 'members',
          action: 'change_role',
          description: 'Change member roles',
          requiredRole: 'owner',
        },

        // Billing permissions
        {
          resource: 'billing',
          action: 'view',
          description: 'View billing and invoices',
          requiredRole: 'admin',
        },
        {
          resource: 'billing',
          action: 'manage',
          description: 'Manage subscription and payment methods',
          requiredRole: 'owner',
        },

        // Data permissions
        {
          resource: 'organizations',
          action: 'view',
          description: 'View organizations',
          requiredRole: 'member',
        },
        {
          resource: 'organizations',
          action: 'create',
          description: 'Create organizations',
          requiredRole: 'member',
        },
        {
          resource: 'organizations',
          action: 'update',
          description: 'Update organizations',
          requiredRole: 'member',
        },
        {
          resource: 'organizations',
          action: 'delete',
          description: 'Delete organizations',
          requiredRole: 'admin',
        },

        {
          resource: 'deals',
          action: 'view',
          description: 'View deals',
          requiredRole: 'member',
        },
        {
          resource: 'deals',
          action: 'create',
          description: 'Create deals',
          requiredRole: 'member',
        },
        {
          resource: 'deals',
          action: 'update',
          description: 'Update deals',
          requiredRole: 'member',
        },
        {
          resource: 'deals',
          action: 'delete',
          description: 'Delete deals',
          requiredRole: 'admin',
        },

        {
          resource: 'contacts',
          action: 'view',
          description: 'View contacts',
          requiredRole: 'member',
        },
        {
          resource: 'contacts',
          action: 'create',
          description: 'Create contacts',
          requiredRole: 'member',
        },
        {
          resource: 'contacts',
          action: 'update',
          description: 'Update contacts',
          requiredRole: 'member',
        },
        {
          resource: 'contacts',
          action: 'delete',
          description: 'Delete contacts',
          requiredRole: 'admin',
        },

        {
          resource: 'tickets',
          action: 'view',
          description: 'View tickets',
          requiredRole: 'member',
        },
        {
          resource: 'tickets',
          action: 'create',
          description: 'Create tickets',
          requiredRole: 'member',
        },
        {
          resource: 'tickets',
          action: 'update',
          description: 'Update tickets',
          requiredRole: 'member',
        },
        {
          resource: 'tickets',
          action: 'delete',
          description: 'Delete tickets',
          requiredRole: 'admin',
        },

        {
          resource: 'meetings',
          action: 'view',
          description: 'View meetings',
          requiredRole: 'member',
        },
        {
          resource: 'meetings',
          action: 'create',
          description: 'Create meetings',
          requiredRole: 'member',
        },
        {
          resource: 'meetings',
          action: 'update',
          description: 'Update meetings',
          requiredRole: 'member',
        },
        {
          resource: 'meetings',
          action: 'delete',
          description: 'Delete meetings',
          requiredRole: 'admin',
        },

        // Audit log permissions
        {
          resource: 'audit_log',
          action: 'view',
          description: 'View audit logs (Enterprise only)',
          requiredRole: 'admin',
        },

        // API permissions
        {
          resource: 'api_keys',
          action: 'view',
          description: 'View API keys',
          requiredRole: 'admin',
        },
        {
          resource: 'api_keys',
          action: 'create',
          description: 'Create API keys',
          requiredRole: 'admin',
        },
        {
          resource: 'api_keys',
          action: 'revoke',
          description: 'Revoke API keys',
          requiredRole: 'admin',
        },
      ])
      .onConflictDoNothing();

    console.log('✅ Permissions seeded (45 default permissions)');

    console.log('\n✨ Seed completed successfully!');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    throw error;
  } finally {
    console.log('\n🔌 Closing database connection...');
    await sql.end();
  }
}

seed().catch((error) => {
  console.error('Fatal error during seed:', error);
  process.exit(1);
});
