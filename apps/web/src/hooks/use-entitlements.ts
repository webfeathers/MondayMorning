import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Entitlements {
  plan: {
    slug: string;
    features: {
      configurableDashboards: boolean;
      webhookSync: boolean;
      whiteLabel: boolean;
      apiAccess: boolean;
    };
  };
  subscription: {
    status: string;
  };
  entitlements: {
    seats: {
      used: number;
      limit: number;
    };
    credits: {
      used: number;
      limit: number;
      remaining: number;
    };
  };
}

/**
 * Hook to fetch current tenant's entitlements and plan info
 * Used for feature gating and displaying usage stats
 */
export function useEntitlements() {
  return useQuery({
    queryKey: ['entitlements'],
    queryFn: () => apiClient.get<Entitlements>('/api/billing/plan'),
    staleTime: 5 * 60 * 1000, // 5 minutes - entitlements don't change often
  });
}
