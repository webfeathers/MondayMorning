'use client';

import { useContext } from 'react';
import { TenantContext, Tenant } from '../providers/tenant-provider';

/**
 * useTenant hook
 * Consumes the tenant context and returns tenant data
 *
 * @throws Error if used outside of TenantProvider
 *
 * @returns Tenant object with { id, slug, name }
 *
 * Usage in client components:
 * ```tsx
 * 'use client';
 *
 * import { useTenant } from '@/hooks/useTenant';
 *
 * export function MyComponent() {
 *   const tenant = useTenant();
 *
 *   return <div>Welcome to {tenant.name}!</div>;
 * }
 * ```
 */
export function useTenant(): Tenant {
  const tenant = useContext(TenantContext);

  if (!tenant) {
    throw new Error('useTenant must be used within a TenantProvider');
  }

  return tenant;
}
