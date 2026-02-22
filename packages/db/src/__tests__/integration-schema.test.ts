import { describe, it, expect } from 'vitest';
import {
  integrationConnections,
  customFieldDefinitions,
  stageMappings,
  syncEvents
} from '../schema';

describe('Integration, Mapping & Sync Schema', () => {
  it('integration_connections has required columns', () => {
    const columns = Object.keys(integrationConnections);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('providerType');
    expect(columns).toContain('providerName');
    expect(columns).toContain('credentials');
    expect(columns).toContain('syncState');
    expect(columns).toContain('syncSchedule');
    expect(columns).toContain('isActive');
    expect(columns).toContain('lastSyncedAt');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  it('custom_field_definitions has required columns', () => {
    const columns = Object.keys(customFieldDefinitions);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('entityType');
    expect(columns).toContain('fieldName');
    expect(columns).toContain('fieldType');
    expect(columns).toContain('sourceProvider');
    expect(columns).toContain('sourceFieldName');
    expect(columns).toContain('mappingStatus');
    expect(columns).toContain('isRequired');
    expect(columns).toContain('defaultValue');
  });

  it('stage_mappings has required columns', () => {
    const columns = Object.keys(stageMappings);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('integrationConnectionId');
    expect(columns).toContain('sourceStage');
    expect(columns).toContain('normalizedStage');
    expect(columns).toContain('isClosed');
    expect(columns).toContain('isWon');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  it('sync_events has append-only audit log structure', () => {
    const columns = Object.keys(syncEvents);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('integrationConnectionId');
    expect(columns).toContain('eventType');
    expect(columns).toContain('entityType');
    expect(columns).toContain('recordsProcessed');
    expect(columns).toContain('recordsCreated');
    expect(columns).toContain('recordsUpdated');
    expect(columns).toContain('recordsSkipped');
    expect(columns).toContain('recordsFailed');
    expect(columns).toContain('status');
    expect(columns).toContain('errorMessage');
    expect(columns).toContain('metadata');
    expect(columns).toContain('startedAt');
    expect(columns).toContain('completedAt');
    expect(columns).toContain('createdAt');
  });

  it('all integration tables have tenant_id', () => {
    expect(Object.keys(integrationConnections)).toContain('tenantId');
    expect(Object.keys(customFieldDefinitions)).toContain('tenantId');
    expect(Object.keys(stageMappings)).toContain('tenantId');
    expect(Object.keys(syncEvents)).toContain('tenantId');
  });

  it('custom_field_definitions has mapping_status for immutability', () => {
    const columns = Object.keys(customFieldDefinitions);
    expect(columns).toContain('mappingStatus');
  });

  it('stage_mappings has is_closed and is_won for CRM-agnostic queries', () => {
    const columns = Object.keys(stageMappings);
    expect(columns).toContain('isClosed');
    expect(columns).toContain('isWon');
  });
});
