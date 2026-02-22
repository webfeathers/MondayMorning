import { headers } from 'next/headers';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Login Page
 * Displays tenant-branded login with Google OAuth
 * - Shows tenant name from headers
 * - Displays error messages from URL params
 * - Links to /auth/initiate for OAuth flow
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const headersList = await headers();
  const tenantName = headersList.get('X-Tenant-Name') || 'WF Platform';

  const params = await searchParams;
  const error = params.error;

  // Map error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    missing_code: 'Authentication failed. Please try again.',
    missing_state: 'Invalid authentication request. Please try again.',
    invalid_state: 'Security verification failed. Please try again.',
    configuration_error: 'Server configuration error. Please contact support.',
    missing_tenant: 'Tenant not found. Please check your subdomain.',
    authentication_failed: 'Authentication failed. Please try again.',
    access_denied: 'You denied access. Please authorize to continue.',
  };

  const errorMessage = error ? errorMessages[error] || 'An unexpected error occurred. Please try again.' : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">
            {tenantName}
          </CardTitle>
          <CardDescription className="text-base">
            Sign in to access your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              <p className="font-medium">Error</p>
              <p className="mt-1">{errorMessage}</p>
            </div>
          )}

          <div className="space-y-3">
            <Link href="/auth/initiate" className="block">
              <Button
                className="w-full h-12 text-base font-medium"
                size="lg"
              >
                <svg
                  className="mr-2 h-5 w-5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                >
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </Button>
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              By signing in, you agree to our{' '}
              <Link href="/terms" className="underline hover:text-foreground">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
