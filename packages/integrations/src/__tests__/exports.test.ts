/**
 * Tests for package exports
 *
 * Verifies that all expected exports are available from the main index
 */

import { describe, it, expect } from 'vitest';
import { MockCRMAdapter } from '../index';

describe('Package Exports', () => {
  it('exports MockCRMAdapter class', () => {
    expect(MockCRMAdapter).toBeDefined();
    expect(typeof MockCRMAdapter).toBe('function');
  });

  it('can instantiate MockCRMAdapter', () => {
    const adapter = new MockCRMAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.authenticate).toBe('function');
    expect(typeof adapter.syncDeals).toBe('function');
  });
});
