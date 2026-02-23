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

// Field mapper pipeline
export {
  mapFields,
  coerceValue,
  applyTransform,
  normalizeStage,
  validateRecord,
  extractCustomFields,
} from './core/field-mapper';
export type {
  ValidationResult,
  StageNormalizationResult,
} from './core/field-mapper';

// Transformation registry
export {
  registerTransform,
  getTransform,
  listTransforms,
} from './core/transformations';
export type { TransformFunction } from './core/transformations';

// Sync engine
export {
  syncDeals,
  syncAccounts,
  syncContacts,
  syncTickets,
} from './core/sync-engine';
export type { SyncResult as SyncEngineResult } from './core/sync-engine';

// Connection manager
export {
  createConnection,
  getConnection,
  refreshConnection,
  testConnection,
  listConnections,
  deleteConnection,
  updateSyncState,
} from './core/connection-manager';

// Encryption utilities
export {
  encryptCredentials,
  decryptCredentials,
} from './core/encryption';

// Provider registry
export {
  getProviderType,
  getAdapter,
} from './core/provider-registry';
