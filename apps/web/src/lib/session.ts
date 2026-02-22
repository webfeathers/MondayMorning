import { cookies, headers } from 'next/headers';
import { validateSession, verifyCookie } from '@wf/auth';
import { redirect } from 'next/navigation';

export interface SessionData {
  sessionId: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
  lastActiveAt: Date;
}

/**
 * Gets the current session from the signed cookie
 * Returns null if no valid session exists
 *
 * @returns SessionData if valid session, null otherwise
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const signedToken = cookieStore.get('session')?.value;

    if (!signedToken) {
      return null;
    }

    // Verify and extract the token from signed cookie
    const signingSecret = process.env.SESSION_SIGNING_SECRET;
    if (!signingSecret) {
      console.error('SESSION_SIGNING_SECRET not configured');
      return null;
    }

    const token = verifyCookie(signedToken, signingSecret);
    if (!token) {
      console.warn('Invalid session cookie signature');
      return null;
    }

    // Validate the session token
    const session = await validateSession(token);

    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Requires a valid session, redirects to login if not authenticated
 *
 * @returns SessionData
 * @throws Redirects to /login if no valid session
 */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession();

  if (!session) {
    // Get the current URL for redirect after login
    const headersList = await headers();
    const fullUrl = headersList.get('x-url') || '/';

    redirect(`/login?redirect=${encodeURIComponent(fullUrl)}`);
  }

  return session;
}

/**
 * Validates that the session's tenant matches the request's tenant
 * This prevents cross-tenant access via session cookies
 *
 * @param session - The session data
 * @returns true if tenant matches, false otherwise
 */
export async function validateTenantMatch(session: SessionData): Promise<boolean> {
  try {
    const headersList = await headers();
    const requestTenantId = headersList.get('X-Tenant-Id');

    if (!requestTenantId) {
      console.warn('No tenant ID in request headers');
      return false;
    }

    return session.tenantId === requestTenantId;
  } catch (error) {
    console.error('Error validating tenant match:', error);
    return false;
  }
}

/**
 * Requires a valid session AND validates tenant match
 * Use this for all tenant-scoped routes to prevent cross-tenant access
 *
 * @returns SessionData with validated tenant
 * @throws Redirects to /login if session invalid or tenant mismatch
 */
export async function requireTenantSession(): Promise<SessionData> {
  const session = await requireSession();

  const isValidTenant = await validateTenantMatch(session);
  if (!isValidTenant) {
    console.warn('Tenant mismatch - session tenant does not match request tenant');
    redirect('/login?error=tenant_mismatch');
  }

  return session;
}
