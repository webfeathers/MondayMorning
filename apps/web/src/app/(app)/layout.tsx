import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession, unsignCookie } from '@wf/auth';
import { db, users } from '@wf/db';
import { eq } from 'drizzle-orm';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { StoreHydrator } from '@/components/store-hydrator';

/**
 * App Shell Layout
 * Wraps all authenticated app pages with sidebar and header
 * Validates session and redirects to login if not authenticated
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get session from cookie
  const cookieStore = await cookies();
  const signedToken = cookieStore.get('session')?.value;

  if (!signedToken) {
    redirect('/login');
  }

  const sessionSigningSecret = process.env.SESSION_SIGNING_SECRET;
  if (!sessionSigningSecret) {
    throw new Error('SESSION_SIGNING_SECRET not configured');
  }

  let sessionData;
  let user;

  try {
    const token = unsignCookie(signedToken, sessionSigningSecret);
    sessionData = await validateSession(token);

    if (!sessionData) {
      redirect('/login');
    }

    // Fetch user info
    user = await db.query.users.findFirst({
      where: eq(users.id, sessionData.userId),
    });

    if (!user) {
      redirect('/login');
    }
  } catch (error) {
    console.error('Error validating session:', error);
    redirect('/login');
  }

  // Get tenant info from headers (injected by middleware)
  const headersList = await headers();
  const tenantId = headersList.get('X-Tenant-Id') || '';
  const tenantSlug = headersList.get('X-Tenant-Slug') || '';
  const tenantName = headersList.get('X-Tenant-Name') || 'WF Platform';

  return (
    <>
      {/* Hydrate client stores with server data */}
      <StoreHydrator
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
        tenant={{
          id: tenantId,
          slug: tenantSlug,
          name: tenantName,
        }}
      />

      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <AppSidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <AppHeader
            user={{
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
            }}
            tenantName={tenantName}
          />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
