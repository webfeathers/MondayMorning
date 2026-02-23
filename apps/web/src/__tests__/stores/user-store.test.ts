import { describe, it, expect, beforeEach } from 'vitest';
import { useUserStore } from '@/stores/user-store';

describe('User Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUserStore.getState().clear();
  });

  describe('User', () => {
    it('sets and retrieves user', () => {
      const { setUser } = useUserStore.getState();

      const testUser = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      setUser(testUser);

      const state = useUserStore.getState();
      expect(state.user).toEqual(testUser);
    });

    it('handles null user', () => {
      const { setUser } = useUserStore.getState();

      setUser(null);

      const state = useUserStore.getState();
      expect(state.user).toBe(null);
    });
  });

  describe('Tenant', () => {
    it('sets and retrieves tenant', () => {
      const { setTenant } = useUserStore.getState();

      const testTenant = {
        id: 'tenant-1',
        slug: 'acme',
        name: 'Acme Corp',
      };

      setTenant(testTenant);

      const state = useUserStore.getState();
      expect(state.tenant).toEqual(testTenant);
    });
  });

  describe('Permissions', () => {
    it('sets and checks permissions', () => {
      const { setPermissions, hasPermission } = useUserStore.getState();

      setPermissions(['read:organizations', 'write:deals']);

      expect(hasPermission('read:organizations')).toBe(true);
      expect(hasPermission('write:deals')).toBe(true);
      expect(hasPermission('delete:tickets')).toBe(false);
    });

    it('handles empty permissions', () => {
      const { hasPermission } = useUserStore.getState();

      expect(hasPermission('any:permission')).toBe(false);
    });
  });

  describe('Entitlements', () => {
    it('sets and retrieves entitlements', () => {
      const { setEntitlements } = useUserStore.getState();

      const testEntitlements = {
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: false,
        },
        seats: {
          current: 5,
          max: 50,
          canAddMore: true,
        },
        credits: {
          allocated: 500,
          used: 120,
          remaining: 380,
          unlimited: false,
        },
      };

      setEntitlements(testEntitlements);

      const state = useUserStore.getState();
      expect(state.entitlements).toEqual(testEntitlements);
    });

    it('checks feature entitlements', () => {
      const { setEntitlements, hasFeature } = useUserStore.getState();

      setEntitlements({
        features: {
          configurableDashboards: true,
          webhookSync: false,
          whiteLabel: true,
          apiAccess: false,
        },
        seats: {
          current: 1,
          max: 5,
          canAddMore: true,
        },
        credits: {
          allocated: 100,
          used: 0,
          remaining: 100,
          unlimited: false,
        },
      });

      expect(hasFeature('configurableDashboards')).toBe(true);
      expect(hasFeature('webhookSync')).toBe(false);
      expect(hasFeature('whiteLabel')).toBe(true);
      expect(hasFeature('apiAccess')).toBe(false);
    });

    it('returns false for features when entitlements are null', () => {
      const { hasFeature } = useUserStore.getState();

      expect(hasFeature('configurableDashboards')).toBe(false);
      expect(hasFeature('webhookSync')).toBe(false);
    });
  });

  describe('Clear', () => {
    it('clears all state', () => {
      const { setUser, setTenant, setPermissions, setEntitlements, clear } =
        useUserStore.getState();

      // Set some data
      setUser({
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: null,
      });
      setTenant({
        id: 'tenant-1',
        slug: 'test',
        name: 'Test Tenant',
      });
      setPermissions(['read:all']);
      setEntitlements({
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: false,
        },
        seats: { current: 1, max: 5, canAddMore: true },
        credits: { allocated: 100, used: 0, remaining: 100, unlimited: false },
      });

      // Clear state
      clear();

      const state = useUserStore.getState();
      expect(state.user).toBe(null);
      expect(state.tenant).toBe(null);
      expect(state.permissions).toEqual([]);
      expect(state.entitlements).toBe(null);
    });
  });
});
