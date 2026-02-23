/**
 * Provider registry for mapping provider names to adapters and metadata
 */

import type { CRMProvider } from '../types/crm-provider';
import { MockCRMAdapter } from '../adapters/mock-crm-adapter';

/**
 * Provider adapter constructor type
 */
type AdapterConstructor = new (credentials?: any) => CRMProvider;

/**
 * Provider metadata interface
 */
export interface ProviderMetadata {
  name: string;
  type: string;
  displayName: string;
  description: string;
  requiredCredentials: string[];
  supportsWebhooks: boolean;
  supportedObjects: string[];
}

/**
 * Provider registration interface
 */
interface ProviderRegistration {
  name: string;
  type: string;
  adapterClass: AdapterConstructor;
  metadata: ProviderMetadata;
}

/**
 * Provider type mapping
 */
const PROVIDER_TYPES: Record<string, string> = {
  // CRM providers
  salesforce: 'crm',
  hubspot: 'crm',
  pipedrive: 'crm',
  zoho: 'crm',

  // Meeting providers
  avoma: 'meeting',
  gong: 'meeting',
  chorus: 'meeting',

  // Ticketing providers
  zendesk: 'ticketing',
  jira: 'ticketing',
  linear: 'ticketing',

  // Enrichment providers
  zoominfo: 'enrichment',
  clearbit: 'enrichment',
};

/**
 * Provider adapter mapping
 * Maps provider name to adapter class
 */
const PROVIDER_ADAPTERS: Record<string, AdapterConstructor> = {};

/**
 * Provider metadata storage
 */
const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  salesforce: {
    name: 'salesforce',
    type: 'crm',
    displayName: 'Salesforce',
    description: 'Salesforce CRM integration with support for Accounts, Contacts, Opportunities, and custom objects',
    requiredCredentials: ['clientId', 'clientSecret', 'instanceUrl', 'refreshToken'],
    supportsWebhooks: true,
    supportedObjects: ['Account', 'Contact', 'Opportunity', 'Lead', 'Case', 'Task'],
  },
  hubspot: {
    name: 'hubspot',
    type: 'crm',
    displayName: 'HubSpot',
    description: 'HubSpot CRM integration with support for Companies, Contacts, and Deals',
    requiredCredentials: ['apiKey'],
    supportsWebhooks: true,
    supportedObjects: ['Company', 'Contact', 'Deal', 'Ticket'],
  },
  pipedrive: {
    name: 'pipedrive',
    type: 'crm',
    displayName: 'Pipedrive',
    description: 'Pipedrive CRM integration with focus on deals and pipeline management',
    requiredCredentials: ['apiToken', 'companyDomain'],
    supportsWebhooks: true,
    supportedObjects: ['Organization', 'Person', 'Deal', 'Activity'],
  },
  zoho: {
    name: 'zoho',
    type: 'crm',
    displayName: 'Zoho CRM',
    description: 'Zoho CRM integration with support for multiple modules',
    requiredCredentials: ['clientId', 'clientSecret', 'refreshToken', 'dataCenterId'],
    supportsWebhooks: false,
    supportedObjects: ['Account', 'Contact', 'Deal', 'Lead'],
  },
  avoma: {
    name: 'avoma',
    type: 'meeting',
    displayName: 'Avoma',
    description: 'Avoma meeting intelligence platform integration',
    requiredCredentials: ['apiKey'],
    supportsWebhooks: true,
    supportedObjects: ['Meeting', 'Transcript', 'Note'],
  },
  gong: {
    name: 'gong',
    type: 'meeting',
    displayName: 'Gong',
    description: 'Gong revenue intelligence platform integration',
    requiredCredentials: ['apiKey', 'apiSecret'],
    supportsWebhooks: false,
    supportedObjects: ['Call', 'Meeting', 'Transcript'],
  },
  chorus: {
    name: 'chorus',
    type: 'meeting',
    displayName: 'Chorus.ai',
    description: 'Chorus.ai conversation intelligence platform',
    requiredCredentials: ['apiKey'],
    supportsWebhooks: false,
    supportedObjects: ['Call', 'Meeting'],
  },
  zendesk: {
    name: 'zendesk',
    type: 'ticketing',
    displayName: 'Zendesk',
    description: 'Zendesk customer support platform integration',
    requiredCredentials: ['subdomain', 'email', 'apiToken'],
    supportsWebhooks: true,
    supportedObjects: ['Ticket', 'User', 'Organization'],
  },
  jira: {
    name: 'jira',
    type: 'ticketing',
    displayName: 'Jira',
    description: 'Atlassian Jira project management and issue tracking',
    requiredCredentials: ['cloudId', 'email', 'apiToken'],
    supportsWebhooks: true,
    supportedObjects: ['Issue', 'Project', 'User'],
  },
  linear: {
    name: 'linear',
    type: 'ticketing',
    displayName: 'Linear',
    description: 'Linear issue tracking and project management',
    requiredCredentials: ['apiKey'],
    supportsWebhooks: true,
    supportedObjects: ['Issue', 'Project', 'Team'],
  },
  zoominfo: {
    name: 'zoominfo',
    type: 'enrichment',
    displayName: 'ZoomInfo',
    description: 'ZoomInfo contact and company enrichment',
    requiredCredentials: ['apiKey'],
    supportsWebhooks: false,
    supportedObjects: ['Contact', 'Company'],
  },
  clearbit: {
    name: 'clearbit',
    type: 'enrichment',
    displayName: 'Clearbit',
    description: 'Clearbit company and contact enrichment',
    requiredCredentials: ['apiKey'],
    supportsWebhooks: true,
    supportedObjects: ['Company', 'Person'],
  },
};

/**
 * Get provider type from provider name
 */
export function getProviderType(providerName: string): string {
  const type = PROVIDER_TYPES[providerName.toLowerCase()];
  if (!type) {
    throw new Error(`Unknown provider: ${providerName}`);
  }
  return type;
}

/**
 * Get adapter instance for a provider
 *
 * For now, returns MockCRMAdapter for all CRM providers.
 * In production, this would instantiate the appropriate adapter class.
 */
export function getAdapter(providerName: string, credentials: any): CRMProvider {
  const normalizedName = providerName.toLowerCase();

  // Check if there's a registered adapter for this provider
  const AdapterClass = PROVIDER_ADAPTERS[normalizedName];
  if (AdapterClass) {
    return new AdapterClass(credentials);
  }

  // Fallback to default behavior for built-in providers
  const type = getProviderType(providerName);

  if (type === 'crm') {
    // In production, switch based on providerName:
    // case 'salesforce': return new SalesforceAdapter(credentials);
    // case 'hubspot': return new HubSpotAdapter(credentials);
    return new MockCRMAdapter();
  }

  throw new Error(`No adapter available for provider type: ${type}`);
}

/**
 * Register a provider dynamically
 *
 * Allows adding new providers at runtime or overriding existing ones
 */
export function registerProvider(
  name: string,
  type: string,
  adapterClass: AdapterConstructor,
  metadata?: Partial<ProviderMetadata>
): void {
  if (!name || name.trim() === '') {
    throw new Error('Provider name cannot be empty');
  }
  if (!type || type.trim() === '') {
    throw new Error('Provider type cannot be empty');
  }

  const normalizedName = name.toLowerCase();

  // Register the provider type
  PROVIDER_TYPES[normalizedName] = type;

  // Register the adapter class
  PROVIDER_ADAPTERS[normalizedName] = adapterClass;

  // Register or update metadata
  PROVIDER_METADATA[normalizedName] = {
    name: normalizedName,
    type,
    displayName: metadata?.displayName || name,
    description: metadata?.description || `${name} integration`,
    requiredCredentials: metadata?.requiredCredentials || [],
    supportsWebhooks: metadata?.supportsWebhooks ?? false,
    supportedObjects: metadata?.supportedObjects || [],
  };
}

/**
 * List all registered providers, optionally filtered by type
 */
export function listProviders(
  filterType?: string
): Array<{ name: string; type: string; displayName: string }> {
  const providers = Object.entries(PROVIDER_TYPES).map(([name, type]) => ({
    name,
    type,
    displayName: PROVIDER_METADATA[name]?.displayName || name,
  }));

  if (filterType) {
    return providers.filter((p) => p.type === filterType);
  }

  return providers;
}

/**
 * Get metadata for a specific provider
 */
export function getProviderMetadata(providerName: string): ProviderMetadata {
  const normalizedName = providerName.toLowerCase();

  // Verify the provider exists
  if (!PROVIDER_TYPES[normalizedName]) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  const metadata = PROVIDER_METADATA[normalizedName];
  if (!metadata) {
    // Return minimal metadata if not explicitly defined
    return {
      name: normalizedName,
      type: PROVIDER_TYPES[normalizedName],
      displayName: providerName,
      description: `${providerName} integration`,
      requiredCredentials: [],
      supportsWebhooks: false,
      supportedObjects: [],
    };
  }

  return metadata;
}
