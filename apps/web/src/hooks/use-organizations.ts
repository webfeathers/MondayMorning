import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Organization {
  id: string;
  name: string;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationsResponse {
  organizations: Organization[];
  total: number;
  page: number;
  pageSize: number;
}

interface OrganizationsFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Hook to fetch paginated list of organizations
 * Will be fully implemented in Task 6.7
 */
export function useOrganizations(filters: OrganizationsFilters = {}) {
  return useQuery({
    queryKey: ['organizations', filters],
    queryFn: () =>
      apiClient.get<OrganizationsResponse>('/api/organizations', {
        params: filters as Record<string, string>,
      }),
    // Placeholder - will be implemented when API endpoint is ready
    enabled: false,
  });
}

/**
 * Hook to fetch a single organization by ID
 * Will be fully implemented in Task 6.7
 */
export function useOrganization(id: string) {
  return useQuery({
    queryKey: ['organizations', id],
    queryFn: () => apiClient.get<Organization>(`/api/organizations/${id}`),
    enabled: !!id,
  });
}

/**
 * Hook to create a new organization
 * Will be fully implemented in Task 6.7
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Organization>) =>
      apiClient.post<Organization>('/api/organizations', data),
    onSuccess: () => {
      // Invalidate organizations list to refetch
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

/**
 * Hook to update an organization
 * Will be fully implemented in Task 6.7
 */
export function useUpdateOrganization(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Organization>) =>
      apiClient.patch<Organization>(`/api/organizations/${id}`, data),
    onSuccess: () => {
      // Invalidate both the list and the single item
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', id] });
    },
  });
}

/**
 * Hook to delete an organization
 * Will be fully implemented in Task 6.7
 */
export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/organizations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}
