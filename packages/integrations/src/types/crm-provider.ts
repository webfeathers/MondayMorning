/**
 * CRMProvider Interface
 *
 * Core abstraction for all CRM integrations (Salesforce, HubSpot, etc.).
 * This interface defines the contract that all CRM adapters must implement,
 * enabling a unified integration layer across different CRM platforms.
 *
 * Design Principles:
 * - Provider-agnostic: Methods work with any CRM system
 * - Async by default: All operations return Promises for better scalability
 * - Type-safe: Leverages TypeScript for compile-time safety
 * - Resource-aware: Includes rate limiting and quota management
 */

// Import supporting types that will be defined in Task 3.3
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
} from './sync-types';

/**
 * CRMProvider interface - the core abstraction for all CRM integrations.
 *
 * Implementations of this interface provide a standardized way to:
 * - Authenticate with CRM providers
 * - Discover CRM schemas (objects and fields)
 * - Sync data from CRM to normalized tables
 * - Manage rate limits and quotas
 * - Handle webhook subscriptions
 *
 * @example
 * ```typescript
 * const provider = new SalesforceAdapter(config);
 *
 * // Authenticate
 * const authResult = await provider.authenticate(credentials);
 *
 * // Discover schema
 * const objects = await provider.discoverObjects();
 * const dealFields = await provider.discoverFields('Opportunity');
 *
 * // Sync data
 * const result = await provider.syncDeals({
 *   lastSyncedAt: '2026-02-20T00:00:00Z',
 *   batchSize: 100
 * });
 * ```
 */
export interface CRMProvider {
  // ============================================
  // AUTHENTICATION METHODS
  // ============================================

  /**
   * Establish an authenticated connection with the CRM provider.
   *
   * Handles OAuth flows, API key authentication, or other provider-specific
   * authentication mechanisms. Should store refresh tokens internally for
   * automatic token renewal.
   *
   * @param credentials - Provider-specific credentials (OAuth tokens, API keys, etc.)
   * @returns Promise resolving to authentication result with tokens and metadata
   *
   * @throws {AuthenticationError} If credentials are invalid or authentication fails
   *
   * @example
   * ```typescript
   * // OAuth flow
   * const result = await provider.authenticate({
   *   code: 'authorization_code',
   *   redirectUri: 'https://app.example.com/oauth/callback'
   * });
   *
   * // API key
   * const result = await provider.authenticate({
   *   apiKey: 'sk_live_...'
   * });
   * ```
   */
  authenticate(credentials: Record<string, unknown>): Promise<AuthResult>;

  /**
   * Refresh an expired OAuth access token using a refresh token.
   *
   * Should be called automatically when detecting token expiration during API calls.
   * The new tokens should be persisted to the integration_connections table.
   *
   * @param refreshToken - The OAuth refresh token
   * @returns Promise resolving to new authentication result with refreshed tokens
   *
   * @throws {AuthenticationError} If refresh token is invalid or revoked
   *
   * @example
   * ```typescript
   * try {
   *   const result = await provider.syncDeals(options);
   * } catch (error) {
   *   if (error.code === 'TOKEN_EXPIRED') {
   *     const newAuth = await provider.refreshToken(storedRefreshToken);
   *     // Retry the operation
   *   }
   * }
   * ```
   */
  refreshToken(refreshToken: string): Promise<AuthResult>;

  /**
   * Test the current connection health and authentication status.
   *
   * Makes a lightweight API call to verify:
   * - Authentication credentials are valid
   * - API is accessible (not experiencing outages)
   * - Network connectivity is working
   *
   * Should be called periodically or before critical sync operations
   * to detect authentication issues early.
   *
   * @returns Promise resolving to true if connection is healthy, false otherwise
   *
   * @example
   * ```typescript
   * const isHealthy = await provider.testConnection();
   * if (!isHealthy) {
   *   // Trigger re-authentication flow
   *   await notifyUserToReconnect();
   * }
   * ```
   */
  testConnection(): Promise<boolean>;

  // ============================================
  // SCHEMA DISCOVERY METHODS
  // ============================================

  /**
   * Discover all available objects (entities) in the CRM.
   *
   * Returns metadata about CRM objects like Account, Contact, Opportunity, Lead, etc.
   * This enables dynamic UI for users to select which objects to sync.
   *
   * @returns Promise resolving to array of object schemas
   *
   * @example
   * ```typescript
   * const objects = await provider.discoverObjects();
   * // [
   * //   { name: 'Account', label: 'Accounts', syncable: true },
   * //   { name: 'Opportunity', label: 'Opportunities', syncable: true },
   * //   { name: 'Contact', label: 'Contacts', syncable: true }
   * // ]
   * ```
   */
  discoverObjects(): Promise<ObjectSchema[]>;

  /**
   * Discover all fields for a specific CRM object type.
   *
   * Returns metadata about each field including:
   * - Field name and data type
   * - Whether it's required, unique, or custom
   * - Picklist values for enumerated fields
   * - Relationships to other objects
   *
   * This data drives the field mapping UI where users map CRM fields
   * to our normalized schema.
   *
   * @param objectType - The CRM object type (e.g., 'Opportunity', 'Account')
   * @returns Promise resolving to array of field schemas
   *
   * @example
   * ```typescript
   * const fields = await provider.discoverFields('Opportunity');
   * // [
   * //   { name: 'Name', type: 'string', required: true, custom: false },
   * //   { name: 'Amount', type: 'currency', required: false, custom: false },
   * //   { name: 'Custom_Score__c', type: 'number', required: false, custom: true }
   * // ]
   * ```
   */
  discoverFields(objectType: string): Promise<FieldSchema[]>;

  /**
   * Get detailed metadata for a specific object type.
   *
   * Returns comprehensive information about the object including:
   * - Supported CRUD operations
   * - Query capabilities and limitations
   * - Record count estimates
   * - Soft delete support
   * - Audit field information
   *
   * Used to optimize sync strategies and inform users about
   * provider-specific capabilities.
   *
   * @param objectType - The CRM object type
   * @returns Promise resolving to object metadata
   *
   * @example
   * ```typescript
   * const metadata = await provider.getObjectMetadata('Opportunity');
   * // {
   * //   queryable: true,
   * //   creatable: true,
   * //   updateable: true,
   * //   deletable: true,
   * //   supportsSoftDelete: true,
   * //   estimatedRecordCount: 15000
   * // }
   * ```
   */
  getObjectMetadata(objectType: string): Promise<ObjectMetadata>;

  // ============================================
  // DATA SYNC METHODS
  // ============================================

  /**
   * Sync deal/opportunity records from the CRM.
   *
   * Fetches deal data based on sync options (incremental vs full sync,
   * batch size, filters). Returns raw CRM data that will be transformed
   * by the field mapper before insertion into our normalized deals table.
   *
   * Supports:
   * - Incremental sync using lastSyncedAt timestamp
   * - Full sync for initial data load
   * - Pagination for large datasets
   * - Custom field inclusion
   *
   * @param options - Sync configuration options
   * @returns Promise resolving to sync result with raw deal records
   *
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {SyncError} If sync operation fails
   *
   * @example
   * ```typescript
   * const result = await provider.syncDeals({
   *   lastSyncedAt: '2026-02-20T00:00:00Z',
   *   batchSize: 100,
   *   includeDeleted: true
   * });
   * // {
   * //   records: [{ id: '123', name: 'Big Deal', amount: 50000, ... }],
   * //   hasMore: false,
   * //   nextPageToken: null,
   * //   syncedAt: '2026-02-23T01:50:00Z'
   * // }
   * ```
   */
  syncDeals(options: SyncOptions): Promise<SyncResult<RawDeal>>;

  /**
   * Sync account/company records from the CRM.
   *
   * Similar to syncDeals but for account/organization entities.
   * Maps to our normalized organizations table.
   *
   * @param options - Sync configuration options
   * @returns Promise resolving to sync result with raw account records
   *
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {SyncError} If sync operation fails
   */
  syncAccounts(options: SyncOptions): Promise<SyncResult<RawAccount>>;

  /**
   * Sync contact/person records from the CRM.
   *
   * Similar to syncDeals but for contact entities.
   * Maps to our normalized contacts table.
   *
   * @param options - Sync configuration options
   * @returns Promise resolving to sync result with raw contact records
   *
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {SyncError} If sync operation fails
   */
  syncContacts(options: SyncOptions): Promise<SyncResult<RawContact>>;

  /**
   * Sync ticket/case records from the CRM.
   *
   * Only supported by CRMs with ticketing functionality (e.g., HubSpot Service Hub,
   * Salesforce Service Cloud). Returns empty result if not supported.
   *
   * Check provider capabilities before calling this method.
   *
   * @param options - Sync configuration options
   * @returns Promise resolving to sync result with raw ticket records
   *
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {SyncError} If sync operation fails
   * @throws {UnsupportedOperationError} If provider doesn't support tickets
   */
  syncTickets(options: SyncOptions): Promise<SyncResult<RawTicket>>;

  // ============================================
  // RATE LIMITING METHODS
  // ============================================

  /**
   * Get current rate limit status for the CRM API.
   *
   * Returns information about:
   * - Current rate limit tier
   * - Requests remaining in current window
   * - Time until rate limit resets
   * - Concurrent request limits
   *
   * Should be checked before bulk sync operations to avoid
   * hitting rate limits and triggering exponential backoff.
   *
   * @returns Promise resolving to current rate limit status
   *
   * @example
   * ```typescript
   * const status = await provider.getRateLimitStatus();
   * // {
   * //   limit: 100000,
   * //   remaining: 45000,
   * //   resetAt: '2026-02-23T02:00:00Z',
   * //   percentUsed: 0.55
   * // }
   *
   * if (status.remaining < 1000) {
   *   // Defer sync until after reset
   *   await scheduleForLater(status.resetAt);
   * }
   * ```
   */
  getRateLimitStatus(): Promise<RateLimitStatus>;

  /**
   * Check if sufficient API quota remains for a sync operation.
   *
   * Returns false if:
   * - Near daily/hourly rate limit
   * - Concurrent request limit reached
   * - In backoff period from previous rate limit hit
   *
   * Sync jobs should call this before starting to avoid wasting
   * API calls on operations that will be rate limited.
   *
   * @returns Promise resolving to true if quota available, false if near limit
   *
   * @example
   * ```typescript
   * const canSync = await provider.checkQuotaRemaining();
   * if (!canSync) {
   *   // Defer job to later
   *   return { status: 'deferred', reason: 'rate_limit' };
   * }
   * // Proceed with sync
   * ```
   */
  checkQuotaRemaining(): Promise<boolean>;

  // ============================================
  // WEBHOOK SUPPORT METHODS
  // ============================================

  /**
   * Check if the CRM provider supports webhook notifications.
   *
   * Returns false for providers without webhook support.
   * If true, webhook methods can be used for real-time sync.
   *
   * @returns True if webhooks are supported, false otherwise
   *
   * @example
   * ```typescript
   * if (provider.supportsWebhooks()) {
   *   await provider.registerWebhook(webhookUrl, ['deal.created', 'deal.updated']);
   * } else {
   *   // Fall back to scheduled polling
   *   await schedulePeriodicSync(tenantId, '0 * * * *'); // hourly
   * }
   * ```
   */
  supportsWebhooks(): boolean;

  /**
   * Register a webhook with the CRM provider for real-time notifications.
   *
   * Registers a webhook endpoint to receive notifications when CRM data changes.
   * This enables near-real-time sync instead of polling.
   *
   * Events vary by provider but typically include:
   * - Object created
   * - Object updated
   * - Object deleted
   *
   * Webhook payloads should be verified using provider-specific signatures
   * before processing.
   *
   * @param url - The webhook endpoint URL (must be publicly accessible HTTPS)
   * @param events - Array of event types to subscribe to
   * @returns Promise resolving to webhook registration details
   *
   * @throws {UnsupportedOperationError} If webhooks not supported
   * @throws {WebhookRegistrationError} If registration fails
   *
   * @example
   * ```typescript
   * const registration = await provider.registerWebhook(
   *   'https://app.example.com/webhooks/salesforce',
   *   ['opportunity.created', 'opportunity.updated', 'opportunity.deleted']
   * );
   * // {
   * //   id: 'webhook_123',
   * //   url: 'https://app.example.com/webhooks/salesforce',
   * //   events: ['opportunity.created', 'opportunity.updated', 'opportunity.deleted'],
   * //   secret: 'whsec_...',
   * //   createdAt: '2026-02-23T01:50:00Z'
   * // }
   * ```
   */
  registerWebhook(url: string, events: string[]): Promise<WebhookRegistration>;

  /**
   * Unregister a previously registered webhook.
   *
   * Should be called when:
   * - Integration is disconnected
   * - Webhook URL changes
   * - Tenant churns
   *
   * @param webhookId - The webhook registration ID from registerWebhook
   * @returns Promise that resolves when webhook is unregistered
   *
   * @throws {WebhookNotFoundError} If webhook ID doesn't exist
   *
   * @example
   * ```typescript
   * await provider.unregisterWebhook('webhook_123');
   * ```
   */
  unregisterWebhook(webhookId: string): Promise<void>;
}
