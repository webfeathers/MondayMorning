// Integration framework exports
// This file will export types, interfaces, and classes for the integration system

// Core CRM provider interface
export type { CRMProvider } from './types/crm-provider';

// Supporting types
export type {
  // Authentication
  AuthResult,
  // Schema discovery
  ObjectSchema,
  FieldSchema,
  ObjectMetadata,
  // Sync operations
  SyncOptions,
  SyncResult,
  // Raw record types
  RawDeal,
  RawAccount,
  RawContact,
  RawTicket,
  // Field mapping
  ValidationRule,
  FieldMapping,
  StageMapping,
  // Rate limiting
  RateLimitConfig,
  RateLimitStatus,
  // Webhooks
  WebhookRegistration,
} from './types/sync-types';

// Adapters
export { MockCRMAdapter } from './adapters/mock-crm-adapter';
