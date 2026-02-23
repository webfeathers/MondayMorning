/**
 * Provider registry for mapping provider names to adapters and metadata
 */

import type { CRMProvider } from '../types/crm-provider';
import { MockCRMAdapter } from '../adapters/mock-crm-adapter';

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
  const type = getProviderType(providerName);

  if (type === 'crm') {
    // In production, switch based on providerName:
    // case 'salesforce': return new SalesforceAdapter(credentials);
    // case 'hubspot': return new HubSpotAdapter(credentials);
    return new MockCRMAdapter();
  }

  throw new Error(`No adapter available for provider type: ${type}`);
}
