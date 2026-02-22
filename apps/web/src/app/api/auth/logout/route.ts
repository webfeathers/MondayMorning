import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSession, unsignCookie, validateSession } from '@wf/auth';

/**
 * POST /api/auth/logout
 * Logs out the current user by revoking their session
 * - Extracts and unsigns session token from cookie
 * - Validates session to get session ID
 * - Revokes session in database
 * - Clears session cookie
 * - Returns redirect URL to /login
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const signedToken = cookieStore.get('session')?.value;

    if (signedToken) {
      // Unsign the token to get the original token value
      const sessionSigningSecret = process.env.SESSION_SIGNING_SECRET;

      if (sessionSigningSecret) {
        try {
          const token = unsignCookie(signedToken, sessionSigningSecret);

          // Validate session to get session ID
          const sessionData = await validateSession(token);

          if (sessionData) {
            // Revoke the session in the database
            await revokeSession(sessionData.sessionId);
          }
        } catch (error) {
          // Log but don't fail - we still want to clear the cookie
          console.error('Error revoking session:', error);
        }
      }
    }

    // Clear the session cookie
    cookieStore.delete('session');

    // Return success response with redirect
    return NextResponse.json(
      { success: true, redirectUrl: '/login' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in logout route:', error);

    // Still clear the cookie even if there's an error
    const cookieStore = await cookies();
    cookieStore.delete('session');

    return NextResponse.json(
      { success: false, error: 'Logout failed', redirectUrl: '/login' },
      { status: 500 }
    );
  }
}
