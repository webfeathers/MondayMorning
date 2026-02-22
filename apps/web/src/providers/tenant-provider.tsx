'use client';

import { createContext, ReactNode } from 'react';

/**
 * Tenant data shape
 * This matches the headers set by middleware:
 * - X-Tenant-Id
 * - X-Tenant-Slug
 * - X-Tenant-Name
 */
export interface Tenant {
  id: string;
  slug: string;
  name: string;
}

/**
 * Tenant context
 * Provides tenant data to all client components
 */
export const TenantContext = createContext<Tenant | null>(null);

interface TenantProviderProps {
  tenant: Tenant;
  children: ReactNode;
}

/**
 * TenantProvider component
 * Wraps the app and provides tenant context from server-injected headers
 *
 * Usage in root layout:
 * ```tsx
 * import { headers } from 'next/headers';
 * import { TenantProvider } from './providers/tenant-provider';
 *
 * export default function RootLayout({ children }) {
 *   const headersList = headers();
 *   const tenant = {
 *     id: headersList.get('X-Tenant-Id'),
 *     slug: headersList.get('X-Tenant-Slug'),
 *     name: headersList.get('X-Tenant-Name'),
 *   };
 *
 *   return (
 *     <html>
 *       <body>
 *         <TenantProvider tenant={tenant}>
 *           {children}
 *         </TenantProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function TenantProvider({ tenant, children }: TenantProviderProps) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}
