import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface DealsResponse {
  deals: Deal[];
  total: number;
  page: number;
  pageSize: number;
}

interface DealsFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  stage?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Hook to fetch paginated list of deals
 * Will be fully implemented in Task 6.8
 */
export function useDeals(filters: DealsFilters = {}) {
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: () =>
      apiClient.get<DealsResponse>('/api/deals', {
        params: filters as Record<string, string>,
      }),
    // Placeholder - will be implemented when API endpoint is ready
    enabled: false,
  });
}

/**
 * Hook to fetch a single deal by ID
 * Will be fully implemented in Task 6.8
 */
export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deals', id],
    queryFn: () => apiClient.get<Deal>(`/api/deals/${id}`),
    enabled: !!id,
  });
}

/**
 * Hook to create a new deal
 * Will be fully implemented in Task 6.8
 */
export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Deal>) =>
      apiClient.post<Deal>('/api/deals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

/**
 * Hook to update a deal
 * Will be fully implemented in Task 6.8
 */
export function useUpdateDeal(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Deal>) =>
      apiClient.patch<Deal>(`/api/deals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deals', id] });
    },
  });
}

/**
 * Hook to delete a deal
 * Will be fully implemented in Task 6.8
 */
export function useDeleteDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/deals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}
