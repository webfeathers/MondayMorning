import { create } from 'zustand';

interface UserState {
  // User info (hydrated from server)
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  setUser: (user: UserState['user']) => void;

  // Tenant info (hydrated from server)
  tenant: {
    id: string;
    slug: string;
    name: string;
  } | null;
  setTenant: (tenant: UserState['tenant']) => void;

  // User permissions (hydrated from server)
  permissions: string[];
  setPermissions: (permissions: string[]) => void;
  hasPermission: (permission: string) => boolean;

  // Entitlements (hydrated from server or API)
  entitlements: {
    features: {
      configurableDashboards: boolean;
      webhookSync: boolean;
      whiteLabel: boolean;
      apiAccess: boolean;
    };
    seats: {
      current: number;
      max: number;
      canAddMore: boolean;
    };
    credits: {
      allocated: number;
      used: number;
      remaining: number;
      unlimited: boolean;
    };
  } | null;
  setEntitlements: (entitlements: UserState['entitlements']) => void;
  hasFeature: (feature: keyof NonNullable<UserState['entitlements']>['features']) => boolean;

  // Clear all state (on logout)
  clear: () => void;
}

export const useUserStore = create<UserState>()((set, get) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),

  // Tenant
  tenant: null,
  setTenant: (tenant) => set({ tenant }),

  // Permissions
  permissions: [],
  setPermissions: (permissions) => set({ permissions }),
  hasPermission: (permission) => {
    const { permissions } = get();
    return permissions.includes(permission);
  },

  // Entitlements
  entitlements: null,
  setEntitlements: (entitlements) => set({ entitlements }),
  hasFeature: (feature) => {
    const { entitlements } = get();
    return entitlements?.features[feature] ?? false;
  },

  // Clear
  clear: () =>
    set({
      user: null,
      tenant: null,
      permissions: [],
      entitlements: null,
    }),
}));
