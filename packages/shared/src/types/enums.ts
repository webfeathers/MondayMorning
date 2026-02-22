export const TenantStatus = {
  ACTIVE: 'active',
  TRIAL: 'trial',
  SUSPENDED: 'suspended',
  CHURNED: 'churned',
} as const;
export type TenantStatus = typeof TenantStatus[keyof typeof TenantStatus];

export const TenantRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type TenantRole = typeof TenantRole[keyof typeof TenantRole];

export const AppRole = {
  EXEC: 'exec',
  AE: 'ae',
  CSM: 'csm',
  SDR: 'sdr',
  SC: 'sc',
  SUPPORT: 'support',
} as const;
export type AppRole = typeof AppRole[keyof typeof AppRole];

export const ProviderType = {
  CRM: 'crm',
  MEETING: 'meeting',
  TICKETING: 'ticketing',
  PROJECT: 'project',
  ENRICHMENT: 'enrichment',
} as const;
export type ProviderType = typeof ProviderType[keyof typeof ProviderType];

export const ProviderName = {
  SALESFORCE: 'salesforce',
  HUBSPOT: 'hubspot',
  AVOMA: 'avoma',
  ZENDESK: 'zendesk',
  ZOOMINFO: 'zoominfo',
} as const;
export type ProviderName = typeof ProviderName[keyof typeof ProviderName];

export const JobStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STALLED: 'stalled',
} as const;
export type JobStatus = typeof JobStatus[keyof typeof JobStatus];

export const PlanSlug = {
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;
export type PlanSlug = typeof PlanSlug[keyof typeof PlanSlug];

export const MappingStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REINDEXING: 'reindexing',
} as const;
export type MappingStatus = typeof MappingStatus[keyof typeof MappingStatus];
