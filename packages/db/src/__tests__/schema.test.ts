import { describe, it, expect } from 'vitest';
import { tenants, users, tenantMembers, sessions } from '../schema';

describe('Core Identity Schema', () => {
  it('tenants table has required columns', () => {
    const columns = Object.keys(tenants);
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('slug');
    expect(columns).toContain('planId');
    expect(columns).toContain('status');
    expect(columns).toContain('settings');
    expect(columns).toContain('stripeCustomerId');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  it('users table has required columns', () => {
    const columns = Object.keys(users);
    expect(columns).toContain('id');
    expect(columns).toContain('email');
    expect(columns).toContain('name');
    expect(columns).toContain('authProvider');
    expect(columns).toContain('authProviderId');
  });

  it('tenantMembers table has required columns', () => {
    const columns = Object.keys(tenantMembers);
    expect(columns).toContain('id');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('userId');
    expect(columns).toContain('role');
    expect(columns).toContain('appRole');
    expect(columns).toContain('status');
  });

  it('sessions table has required columns', () => {
    const columns = Object.keys(sessions);
    expect(columns).toContain('id');
    expect(columns).toContain('userId');
    expect(columns).toContain('tenantId');
    expect(columns).toContain('tokenHash');
    expect(columns).toContain('expiresAt');
  });
});
