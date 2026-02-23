import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { TenantProvider } from '@/providers/tenant-provider';
import { QueryProvider } from '@/providers/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'WF - Multi-Tenant SaaS Platform',
  description: 'Multi-tenant SaaS platform with AI-powered insights',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read tenant information from headers set by middleware
  const headersList = await headers();
  const tenantId = headersList.get('X-Tenant-Id');
  const tenantSlug = headersList.get('X-Tenant-Slug');
  const tenantName = headersList.get('X-Tenant-Name');

  // If tenant headers are present, wrap children with TenantProvider
  // Otherwise, render children directly (for marketing pages, etc.)
  const content = tenantId && tenantSlug && tenantName ? (
    <TenantProvider
      tenant={{
        id: tenantId,
        slug: tenantSlug,
        name: tenantName,
      }}
    >
      {children}
    </TenantProvider>
  ) : (
    children
  );

  return (
    <html lang="en">
      <body className="antialiased">
        <QueryProvider>{content}</QueryProvider>
      </body>
    </html>
  );
}
