import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { validateSession, unsignCookie } from '@wf/auth';
import { db, users } from '@wf/db';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoutButton } from '@/components/logout-button';

/**
 * Home Page
 * Displays dashboard if authenticated, or login prompt if not
 * - Checks session cookie and validates
 * - Shows tenant name and user info if authenticated
 * - Shows login button if not authenticated
 */
export default async function HomePage() {
  // Get session from cookie
  const cookieStore = await cookies();
  const signedToken = cookieStore.get('session')?.value;

  let sessionData = null;
  let user = null;

  if (signedToken) {
    const sessionSigningSecret = process.env.SESSION_SIGNING_SECRET;

    if (sessionSigningSecret) {
      try {
        const token = unsignCookie(signedToken, sessionSigningSecret);
        sessionData = await validateSession(token);

        if (sessionData) {
          // Fetch user info
          user = await db.query.users.findFirst({
            where: eq(users.id, sessionData.userId),
          });
        }
      } catch (error) {
        console.error('Error validating session:', error);
        // Continue as unauthenticated
      }
    }
  }

  // Get tenant info from headers (injected by middleware)
  const headersList = await headers();
  const tenantName = headersList.get('X-Tenant-Name') || 'WF Platform';

  // If authenticated, show dashboard
  if (sessionData && user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-4xl font-bold">
              Welcome to {tenantName}
            </CardTitle>
            <CardDescription className="text-lg">
              Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Logged in as</p>
                  <p className="text-lg font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                {user.avatarUrl && (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-16 w-16 rounded-full border-2 border-primary"
                  />
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-3">Quick Links</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/organizations">
                  <Button variant="outline" className="w-full">
                    Organizations
                  </Button>
                </Link>
                <Link href="/deals">
                  <Button variant="outline" className="w-full">
                    Deals
                  </Button>
                </Link>
                <Link href="/tickets">
                  <Button variant="outline" className="w-full">
                    Tickets
                  </Button>
                </Link>
                <Link href="/contacts">
                  <Button variant="outline" className="w-full">
                    Contacts
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Session expires: {sessionData.expiresAt.toLocaleDateString()}
              </p>
              <LogoutButton />
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // If not authenticated, show login prompt
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-4xl font-bold">
            Welcome to {tenantName}
          </CardTitle>
          <CardDescription className="text-lg">
            Multi-tenant SaaS platform with AI-powered insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-6 space-y-3">
            <p className="text-center text-muted-foreground">
              Sign in to access your workspace and start leveraging AI-powered insights
              for your business data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="font-semibold">Unified Data</h4>
              <p className="text-sm text-muted-foreground">
                Connect CRMs, meetings, tickets
              </p>
            </div>
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h4 className="font-semibold">AI Insights</h4>
              <p className="text-sm text-muted-foreground">
                Automated analysis and recommendations
              </p>
            </div>
            <div className="space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="font-semibold">Fast Setup</h4>
              <p className="text-sm text-muted-foreground">
                Get started in minutes
              </p>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Link href="/login">
              <Button size="lg" className="px-8">
                Sign In to Get Started
              </Button>
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Built with Next.js 15, TypeScript, and Tailwind CSS</p>
            <p className="mt-1">App Router | Turborepo Monorepo | Drizzle ORM</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
