/**
 * Supporting types for CRM integration
 *
 * Full type definitions for the integration framework.
 * These types enable provider-agnostic data synchronization,
 * schema discovery, and field mapping across different CRM systems.
 */

// ============================================
// AUTHENTICATION TYPES
// ============================================

/**
 * Result of authentication with a CRM provider.
 * Contains access tokens, refresh tokens, and metadata.
 */
export interface AuthResult {
  /** OAuth access token or API key */
  accessToken: string;
  /** OAuth refresh token (if applicable) */
  refreshToken?: string;
  /** Token expiration timestamp (ISO 8601) */
  expiresAt?: string;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// ============================================
// SCHEMA DISCOVERY TYPES
// ============================================

/**
 * Schema information for a CRM object type (e.g., Account, Opportunity).
 * Used for dynamic discovery of available objects in the CRM.
 */
export interface ObjectSchema {
  /** API name of the object (e.g., 'Opportunity', 'Account') */
  name: string;
  /** Human-readable label (e.g., 'Opportunities', 'Accounts') */
  label: string;
  /** Whether this object can be synced */
  syncable: boolean;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Schema information for a field within a CRM object.
 * Used for field mapping UI and transformation logic.
 */
export interface FieldSchema {
  /** API name of the field */
  name: string;
  /** Human-readable label */
  label: string;
  /** Data type (string, number, boolean, date, currency, picklist, etc.) */
  type: string;
  /** Whether the field is required */
  required: boolean;
  /** Whether the field is a custom field */
  custom: boolean;
  /** Available options for picklist/enum fields */
  picklistValues?: Array<{ value: string; label: string }>;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Detailed metadata about a CRM object type.
 * Provides information about capabilities and limitations.
 */
export interface ObjectMetadata {
  /** Whether the object can be queried */
  queryable: boolean;
  /** Whether records can be created */
  creatable: boolean;
  /** Whether records can be updated */
  updateable: boolean;
  /** Whether records can be deleted */
  deletable: boolean;
  /** Whether the object supports soft deletes */
  supportsSoftDelete: boolean;
  /** Estimated number of records (for sync planning) */
  estimatedRecordCount?: number;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// ============================================
// SYNC OPERATION TYPES
// ============================================

/**
 * Options for controlling sync behavior.
 * Configures how data is fetched from the CRM provider.
 */
export interface SyncOptions {
  /** Sync mode: full (all records), incremental (changed since cursor), manual (user-triggered), webhook (real-time) */
  mode: 'full' | 'incremental' | 'manual' | 'webhook';
  /** Pagination cursor for incremental sync */
  cursor?: string;
  /** Timestamp for incremental sync filtering (ISO 8601) */
  modifiedSince?: Date;
  /** Maximum number of records to fetch per request */
  limit?: number;
  /** Whether to include soft-deleted records */
  includeDeleted?: boolean;
}

/**
 * Result of a sync operation.
 * Contains raw records from the provider and pagination metadata.
 */
export interface SyncResult<T> {
  /** Raw records from the provider (before field mapping) */
  records: T[];
  /** Pagination cursor for fetching the next page */
  cursor?: string;
  /** Whether more records are available */
  hasMore: boolean;
  /** Sync operation metadata */
  metadata: {
    /** Total number of records processed in this batch */
    totalProcessed: number;
    /** Number of new records created */
    created: number;
    /** Number of existing records updated */
    updated: number;
    /** Number of records skipped (duplicates, validation failures) */
    skipped: number;
    /** Number of records that failed to process */
    failed: number;
  };
}

// ============================================
// RAW RECORD TYPES
// ============================================

/**
 * Raw deal/opportunity record from a CRM provider.
 * Contains provider-specific field names before normalization.
 */
export interface RawDeal {
  /** Unique identifier in the source CRM */
  id: string;
  /** Deal name/title */
  name: string;
  /** Deal amount/value */
  amount?: number;
  /** Currency code (ISO 4217: USD, EUR, etc.) */
  currency?: string;
  /** Deal stage (provider-specific) */
  stage?: string;
  /** Win probability (0-100) */
  probability?: number;
  /** Expected close date (ISO 8601) */
  closeDate?: string;
  /** Owner/assignee ID in the source CRM */
  ownerId?: string;
  /** Associated account/organization ID in the source CRM */
  accountId?: string;
  /** Record creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
  /** Custom fields (provider-specific) */
  customFields: Record<string, any>;
}

/**
 * Raw account/organization record from a CRM provider.
 * Contains provider-specific field names before normalization.
 */
export interface RawAccount {
  /** Unique identifier in the source CRM */
  id: string;
  /** Account/company name */
  name: string;
  /** Company website domain */
  domain?: string;
  /** Industry/vertical */
  industry?: string;
  /** Number of employees */
  employeeCount?: number;
  /** Annual revenue */
  revenue?: number;
  /** Owner/assignee ID in the source CRM */
  ownerId?: string;
  /** Record creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
  /** Custom fields (provider-specific) */
  customFields: Record<string, any>;
}

/**
 * Raw contact/person record from a CRM provider.
 * Contains provider-specific field names before normalization.
 */
export interface RawContact {
  /** Unique identifier in the source CRM */
  id: string;
  /** Contact first name */
  firstName?: string;
  /** Contact last name */
  lastName?: string;
  /** Email address */
  email?: string;
  /** Phone number */
  phone?: string;
  /** Job title */
  title?: string;
  /** Associated account/organization ID in the source CRM */
  accountId?: string;
  /** Owner/assignee ID in the source CRM */
  ownerId?: string;
  /** Record creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
  /** Custom fields (provider-specific) */
  customFields: Record<string, any>;
}

/**
 * Raw ticket/case record from a CRM provider.
 * Contains provider-specific field names before normalization.
 */
export interface RawTicket {
  /** Unique identifier in the source CRM */
  id: string;
  /** Ticket subject/title */
  subject: string;
  /** Ticket status (provider-specific) */
  status?: string;
  /** Priority level (provider-specific) */
  priority?: string;
  /** Category/type (provider-specific) */
  category?: string;
  /** Assignee ID in the source CRM */
  assigneeId?: string;
  /** Associated account/organization ID in the source CRM */
  accountId?: string;
  /** Record creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
  /** Custom fields (provider-specific) */
  customFields: Record<string, any>;
}

// ============================================
// FIELD MAPPING TYPES
// ============================================

/**
 * Validation rule for field mapping.
 * Defines constraints on field values during transformation.
 */
export interface ValidationRule {
  /** Type of validation (required, format, range, enum, etc.) */
  type: string;
  /** Validation parameters (regex pattern, min/max values, allowed values, etc.) */
  params?: Record<string, any>;
  /** Error message if validation fails */
  message?: string;
}

/**
 * Mapping configuration for a single field.
 * Defines how a provider field maps to a normalized field.
 */
export interface FieldMapping {
  /** Source field name in the provider's schema */
  sourceField: string;
  /** Target field name in our normalized schema */
  targetField: string;
  /** Transformation function name (optional) */
  transform?: string;
  /** Default value if source field is null/missing */
  defaultValue?: any;
  /** Validation rules to apply during transformation */
  validationRules?: ValidationRule[];
}

/**
 * Mapping configuration for deal/opportunity stages.
 * Normalizes provider-specific stage names to our standard stages.
 */
export interface StageMapping {
  /** Source stage name in the provider's schema */
  sourceStage: string;
  /** Target stage name in our normalized schema */
  targetStage: string;
  /** Whether this stage represents a closed deal */
  isClosed: boolean;
  /** Whether this stage represents a won deal (only applies if isClosed=true) */
  isWon: boolean;
  /** Win probability for this stage (0-100, optional) */
  probability?: number;
}

// ============================================
// RATE LIMITING TYPES
// ============================================

/**
 * Configuration for rate limiting behavior.
 * Defines limits and retry behavior for API calls.
 */
export interface RateLimitConfig {
  /** Maximum requests per second */
  requestsPerSecond: number;
  /** Maximum requests per day */
  requestsPerDay: number;
  /** Seconds to wait if rate limited (before retry) */
  retryAfter?: number;
}

/**
 * Current rate limit status for a CRM provider.
 * Provides real-time information about API quota usage.
 */
export interface RateLimitStatus {
  /** Total rate limit (requests per period) */
  limit: number;
  /** Remaining requests in current period */
  remaining: number;
  /** Timestamp when rate limit resets (ISO 8601) */
  resetAt: string;
  /** Percentage of quota used (0.0 - 1.0) */
  percentUsed: number;
}

// ============================================
// WEBHOOK TYPES
// ============================================

/**
 * Webhook registration details.
 * Contains information about a registered webhook endpoint.
 */
export interface WebhookRegistration {
  /** Unique webhook ID from the provider */
  id: string;
  /** Webhook endpoint URL */
  url: string;
  /** Events subscribed to */
  events: string[];
  /** Webhook signing secret (for verification) */
  secret?: string;
  /** Registration timestamp (ISO 8601) */
  createdAt: string;
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}
