import { describe, it, expect } from 'vitest';
import { organizations, deals, tickets, contacts, meetings } from '../schema';

describe('Business Data Schema', () => {
  it('all business tables have tenant_id', () => {
    expect(Object.keys(organizations)).toContain('tenantId');
    expect(Object.keys(deals)).toContain('tenantId');
    expect(Object.keys(tickets)).toContain('tenantId');
    expect(Object.keys(contacts)).toContain('tenantId');
    expect(Object.keys(meetings)).toContain('tenantId');
  });

  it('all business tables have soft delete', () => {
    expect(Object.keys(organizations)).toContain('deletedAt');
    expect(Object.keys(deals)).toContain('deletedAt');
    expect(Object.keys(tickets)).toContain('deletedAt');
    expect(Object.keys(contacts)).toContain('deletedAt');
    expect(Object.keys(meetings)).toContain('deletedAt');
  });

  it('all business tables have source tracking', () => {
    expect(Object.keys(deals)).toContain('sourceProvider');
    expect(Object.keys(deals)).toContain('sourceId');
    expect(Object.keys(deals)).toContain('sourceMetadata');
    expect(Object.keys(deals)).toContain('customFields');
  });

  it('deals table has universal CRM fields', () => {
    const cols = Object.keys(deals);
    expect(cols).toContain('name');
    expect(cols).toContain('amount');
    expect(cols).toContain('currency');
    expect(cols).toContain('stage');
    expect(cols).toContain('probability');
    expect(cols).toContain('closeDate');
    expect(cols).toContain('ownerId');
  });
});
