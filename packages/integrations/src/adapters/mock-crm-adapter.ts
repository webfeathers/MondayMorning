/**
 * MockCRMAdapter - A concrete CRM provider implementation for testing
 *
 * This adapter returns realistic canned data without making real API calls,
 * making it perfect for:
 * - Testing the integration framework
 * - Demo/development environments
 * - Unit testing sync engine and field mapper
 *
 * The mock data includes:
 * - Standard CRM fields (name, amount, stage, etc.)
 * - Custom fields to test field mapping
 * - Pagination support with cursor
 * - Realistic data relationships (deals → accounts, contacts → accounts)
 */

import type { CRMProvider } from '../types/crm-provider';
import type {
  AuthResult,
  ObjectSchema,
  FieldSchema,
  ObjectMetadata,
  SyncOptions,
  SyncResult,
  RawDeal,
  RawAccount,
  RawContact,
  RawTicket,
  RateLimitStatus,
  WebhookRegistration,
} from '../types/sync-types';

/**
 * Mock CRM adapter that returns canned data for testing
 */
export class MockCRMAdapter implements CRMProvider {
  private currentPage = 0;

  // ============================================
  // AUTHENTICATION METHODS
  // ============================================

  async authenticate(credentials: Record<string, unknown>): Promise<AuthResult> {
    // Simulate a successful authentication
    return {
      accessToken: 'mock_access_token_abc123',
      refreshToken: 'mock_refresh_token_xyz789',
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      metadata: {
        instanceUrl: 'https://mock-crm.example.com',
        userId: 'mock_user_001',
        organizationId: 'mock_org_001',
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    // Simulate a token refresh
    return {
      accessToken: 'mock_access_token_refreshed',
      refreshToken: 'mock_refresh_token_refreshed',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      metadata: {
        instanceUrl: 'https://mock-crm.example.com',
      },
    };
  }

  async testConnection(): Promise<boolean> {
    // Mock connection always healthy
    return true;
  }

  // ============================================
  // SCHEMA DISCOVERY METHODS
  // ============================================

  async discoverObjects(): Promise<ObjectSchema[]> {
    return [
      {
        name: 'Account',
        label: 'Accounts',
        syncable: true,
        metadata: {
          recordCount: 250,
        },
      },
      {
        name: 'Contact',
        label: 'Contacts',
        syncable: true,
        metadata: {
          recordCount: 800,
        },
      },
      {
        name: 'Deal',
        label: 'Deals',
        syncable: true,
        metadata: {
          recordCount: 150,
        },
      },
      {
        name: 'Ticket',
        label: 'Tickets',
        syncable: true,
        metadata: {
          recordCount: 320,
        },
      },
    ];
  }

  async discoverFields(objectType: string): Promise<FieldSchema[]> {
    const fieldSchemas: Record<string, FieldSchema[]> = {
      Deal: [
        { name: 'Id', label: 'Deal ID', type: 'id', required: true, custom: false },
        { name: 'Name', label: 'Deal Name', type: 'string', required: true, custom: false },
        { name: 'Amount', label: 'Amount', type: 'currency', required: false, custom: false },
        { name: 'Currency', label: 'Currency', type: 'string', required: false, custom: false },
        {
          name: 'Stage',
          label: 'Stage',
          type: 'picklist',
          required: true,
          custom: false,
          picklistValues: [
            { value: 'prospecting', label: 'Prospecting' },
            { value: 'qualification', label: 'Qualification' },
            { value: 'proposal', label: 'Proposal' },
            { value: 'negotiation', label: 'Negotiation' },
            { value: 'closed_won', label: 'Closed Won' },
            { value: 'closed_lost', label: 'Closed Lost' },
          ],
        },
        { name: 'Probability', label: 'Probability', type: 'percent', required: false, custom: false },
        { name: 'CloseDate', label: 'Close Date', type: 'date', required: true, custom: false },
        { name: 'OwnerId', label: 'Owner ID', type: 'reference', required: false, custom: false },
        { name: 'AccountId', label: 'Account ID', type: 'reference', required: false, custom: false },
        { name: 'CreatedAt', label: 'Created Date', type: 'datetime', required: false, custom: false },
        { name: 'UpdatedAt', label: 'Last Modified', type: 'datetime', required: false, custom: false },
        { name: 'Custom_Score__c', label: 'Deal Score', type: 'number', required: false, custom: true },
        {
          name: 'Lead_Source__c',
          label: 'Lead Source',
          type: 'picklist',
          required: false,
          custom: true,
          picklistValues: [
            { value: 'website', label: 'Website' },
            { value: 'referral', label: 'Referral' },
            { value: 'partner', label: 'Partner' },
            { value: 'cold_call', label: 'Cold Call' },
          ],
        },
        { name: 'Custom_Notes__c', label: 'Internal Notes', type: 'textarea', required: false, custom: true },
      ],
      Account: [
        { name: 'Id', label: 'Account ID', type: 'id', required: true, custom: false },
        { name: 'Name', label: 'Account Name', type: 'string', required: true, custom: false },
        { name: 'Domain', label: 'Website', type: 'url', required: false, custom: false },
        { name: 'Industry', label: 'Industry', type: 'string', required: false, custom: false },
        { name: 'EmployeeCount', label: 'Employees', type: 'number', required: false, custom: false },
        { name: 'Revenue', label: 'Annual Revenue', type: 'currency', required: false, custom: false },
        { name: 'OwnerId', label: 'Owner ID', type: 'reference', required: false, custom: false },
        { name: 'CreatedAt', label: 'Created Date', type: 'datetime', required: false, custom: false },
        { name: 'UpdatedAt', label: 'Last Modified', type: 'datetime', required: false, custom: false },
        { name: 'Customer_Tier__c', label: 'Customer Tier', type: 'picklist', required: false, custom: true },
      ],
      Contact: [
        { name: 'Id', label: 'Contact ID', type: 'id', required: true, custom: false },
        { name: 'FirstName', label: 'First Name', type: 'string', required: false, custom: false },
        { name: 'LastName', label: 'Last Name', type: 'string', required: true, custom: false },
        { name: 'Email', label: 'Email', type: 'email', required: false, custom: false },
        { name: 'Phone', label: 'Phone', type: 'phone', required: false, custom: false },
        { name: 'Title', label: 'Job Title', type: 'string', required: false, custom: false },
        { name: 'AccountId', label: 'Account ID', type: 'reference', required: false, custom: false },
        { name: 'OwnerId', label: 'Owner ID', type: 'reference', required: false, custom: false },
        { name: 'CreatedAt', label: 'Created Date', type: 'datetime', required: false, custom: false },
        { name: 'UpdatedAt', label: 'Last Modified', type: 'datetime', required: false, custom: false },
      ],
      Ticket: [
        { name: 'Id', label: 'Ticket ID', type: 'id', required: true, custom: false },
        { name: 'Subject', label: 'Subject', type: 'string', required: true, custom: false },
        { name: 'Status', label: 'Status', type: 'picklist', required: false, custom: false },
        { name: 'Priority', label: 'Priority', type: 'picklist', required: false, custom: false },
        { name: 'Category', label: 'Category', type: 'string', required: false, custom: false },
        { name: 'AssigneeId', label: 'Assignee ID', type: 'reference', required: false, custom: false },
        { name: 'AccountId', label: 'Account ID', type: 'reference', required: false, custom: false },
        { name: 'CreatedAt', label: 'Created Date', type: 'datetime', required: false, custom: false },
        { name: 'UpdatedAt', label: 'Last Modified', type: 'datetime', required: false, custom: false },
      ],
    };

    return fieldSchemas[objectType] || [];
  }

  async getObjectMetadata(objectType: string): Promise<ObjectMetadata> {
    const recordCounts: Record<string, number> = {
      Account: 250,
      Contact: 800,
      Deal: 150,
      Ticket: 320,
    };

    return {
      queryable: true,
      creatable: true,
      updateable: true,
      deletable: true,
      supportsSoftDelete: true,
      estimatedRecordCount: recordCounts[objectType] || 0,
      metadata: {
        hasAuditFields: true,
        maxBatchSize: 2000,
      },
    };
  }

  // ============================================
  // DATA SYNC METHODS
  // ============================================

  async syncDeals(options: SyncOptions): Promise<SyncResult<RawDeal>> {
    const allDeals = this.generateMockDeals();
    const { records, hasMore, cursor } = this.paginate(allDeals, options);

    return {
      records,
      hasMore,
      cursor,
      metadata: {
        totalProcessed: records.length,
        created: records.length,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
    };
  }

  async syncAccounts(options: SyncOptions): Promise<SyncResult<RawAccount>> {
    const allAccounts = this.generateMockAccounts();
    const { records, hasMore, cursor } = this.paginate(allAccounts, options);

    return {
      records,
      hasMore,
      cursor,
      metadata: {
        totalProcessed: records.length,
        created: records.length,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
    };
  }

  async syncContacts(options: SyncOptions): Promise<SyncResult<RawContact>> {
    const allContacts = this.generateMockContacts();
    const { records, hasMore, cursor } = this.paginate(allContacts, options);

    return {
      records,
      hasMore,
      cursor,
      metadata: {
        totalProcessed: records.length,
        created: records.length,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
    };
  }

  async syncTickets(options: SyncOptions): Promise<SyncResult<RawTicket>> {
    const allTickets = this.generateMockTickets();
    const { records, hasMore, cursor } = this.paginate(allTickets, options);

    return {
      records,
      hasMore,
      cursor,
      metadata: {
        totalProcessed: records.length,
        created: records.length,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
    };
  }

  // ============================================
  // RATE LIMITING METHODS
  // ============================================

  async getRateLimitStatus(): Promise<RateLimitStatus> {
    const limit = 100000;
    const remaining = 95000;

    return {
      limit,
      remaining,
      resetAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      percentUsed: (limit - remaining) / limit,
    };
  }

  async checkQuotaRemaining(): Promise<boolean> {
    // Mock always has quota available
    return true;
  }

  // ============================================
  // WEBHOOK SUPPORT METHODS
  // ============================================

  supportsWebhooks(): boolean {
    return true;
  }

  async registerWebhook(url: string, events: string[]): Promise<WebhookRegistration> {
    return {
      id: `webhook_${Date.now()}`,
      url,
      events,
      secret: `whsec_${Math.random().toString(36).substring(7)}`,
      createdAt: new Date().toISOString(),
      metadata: {
        active: true,
      },
    };
  }

  async unregisterWebhook(webhookId: string): Promise<void> {
    // Mock unregister - no-op
    return;
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private generateMockDeals(): RawDeal[] {
    const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    const leadSources = ['website', 'referral', 'partner', 'cold_call'];
    const dealNames = [
      'Enterprise Platform Deal',
      'Strategic Partnership',
      'Q1 Expansion Deal',
      'Mid-Market Opportunity',
      'SMB Quick Win',
      'Annual Contract Renewal',
      'Cross-Sell Opportunity',
      'Upsell - Premium Tier',
      'New Logo - Series A Startup',
      'Fortune 500 Implementation',
    ];

    return dealNames.map((name, i) => ({
      id: `deal_${1000 + i}`,
      name,
      amount: 10000 + i * 15000,
      currency: 'USD',
      stage: stages[i % stages.length],
      probability: [10, 25, 50, 75, 100, 0][i % 6],
      closeDate: new Date(2026, 2 + (i % 6), 15).toISOString(),
      ownerId: `user_${100 + (i % 3)}`,
      accountId: `account_${200 + (i % 5)}`,
      createdAt: new Date(2026, 0, 1 + i).toISOString(),
      updatedAt: new Date(2026, 1, 15 + i).toISOString(),
      customFields: {
        Custom_Score__c: 65 + (i * 5) % 35,
        Lead_Source__c: leadSources[i % leadSources.length],
        Custom_Notes__c: `Internal notes for ${name}`,
      },
    }));
  }

  private generateMockAccounts(): RawAccount[] {
    const industries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing'];
    const accountNames = [
      'Acme Corporation',
      'TechVision Inc',
      'Global Innovations LLC',
      'Summit Enterprises',
      'Horizon Solutions',
      'Velocity Systems',
      'Nexus Partners',
      'Quantum Industries',
      'Atlas Technologies',
      'Pinnacle Group',
    ];

    return accountNames.map((name, i) => ({
      id: `account_${200 + i}`,
      name,
      domain: `${name.toLowerCase().replace(/\s+/g, '')}.com`,
      industry: industries[i % industries.length],
      employeeCount: 50 + i * 100,
      revenue: 1000000 + i * 500000,
      ownerId: `user_${100 + (i % 3)}`,
      createdAt: new Date(2025, 6, 1 + i).toISOString(),
      updatedAt: new Date(2026, 1, 1 + i).toISOString(),
      customFields: {
        Customer_Tier__c: ['Enterprise', 'Mid-Market', 'SMB'][i % 3],
        Support_Level__c: ['Premium', 'Standard', 'Basic'][i % 3],
      },
    }));
  }

  private generateMockContacts(): RawContact[] {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Maria'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const titles = ['CEO', 'CTO', 'VP of Sales', 'Director of Engineering', 'Product Manager', 'Sales Director', 'Head of Marketing', 'CFO', 'COO', 'VP of Product'];

    return firstNames.map((firstName, i) => ({
      id: `contact_${300 + i}`,
      firstName,
      lastName: lastNames[i % lastNames.length],
      email: `${firstName.toLowerCase()}.${lastNames[i % lastNames.length].toLowerCase()}@example.com`,
      phone: `+1-555-${String(1000 + i * 111).substring(0, 4)}`,
      title: titles[i % titles.length],
      accountId: `account_${200 + (i % 5)}`,
      ownerId: `user_${100 + (i % 3)}`,
      createdAt: new Date(2025, 8, 1 + i).toISOString(),
      updatedAt: new Date(2026, 1, 10 + i).toISOString(),
      customFields: {
        LinkedIn_URL__c: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastNames[i % lastNames.length].toLowerCase()}`,
        Decision_Maker__c: i % 3 === 0,
      },
    }));
  }

  private generateMockTickets(): RawTicket[] {
    const statuses = ['new', 'open', 'pending', 'resolved', 'closed'];
    const priorities = ['low', 'medium', 'high', 'critical'];
    const categories = ['bug', 'feature_request', 'question', 'support'];
    const subjects = [
      'Login issues on mobile app',
      'Feature request: Dark mode',
      'API rate limiting questions',
      'Integration not syncing',
      'Performance issues in dashboard',
      'Data export request',
      'Account upgrade assistance',
      'Billing inquiry',
      'Custom field configuration',
      'Webhook delivery failures',
    ];

    return subjects.map((subject, i) => ({
      id: `ticket_${400 + i}`,
      subject,
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      category: categories[i % categories.length],
      assigneeId: `user_${100 + (i % 3)}`,
      accountId: `account_${200 + (i % 5)}`,
      createdAt: new Date(2026, 1, 1 + i).toISOString(),
      updatedAt: new Date(2026, 1, 15 + i).toISOString(),
      customFields: {
        SLA_Deadline__c: new Date(2026, 1, 20 + i).toISOString(),
        Customer_Sentiment__c: ['positive', 'neutral', 'negative'][i % 3],
      },
    }));
  }

  private paginate<T>(
    allRecords: T[],
    options: SyncOptions
  ): { records: T[]; hasMore: boolean; cursor?: string } {
    // Default limit to 10 if not specified
    const limit = options.limit || 10;

    // Parse cursor to determine current page (0-indexed)
    const currentPage = options.cursor ? parseInt(options.cursor, 10) : 0;

    // Calculate slice boundaries
    const start = currentPage * limit;
    const end = start + limit;

    // Extract records for this page
    const records = allRecords.slice(start, end);

    // Determine if there are more records after this page
    const hasMore = end < allRecords.length;

    // Set cursor to next page number if more records exist
    const cursor = hasMore ? String(currentPage + 1) : undefined;

    return { records, hasMore, cursor };
  }
}
