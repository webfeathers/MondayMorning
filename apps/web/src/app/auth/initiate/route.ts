import { NextRequest, NextResponse } from 'next/server';
import { buildAuthorizationUrl, generateStateToken } from '@/lib/oauth/google';
import { cookies } from 'next/headers';

/**
 * GET /auth/initiate
 * Initiates Google OAuth flow by redirecting to Google's authorization endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth not configured (missing GOOGLE_CLIENT_ID)' },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: 'Application URL not configured (missing NEXT_PUBLIC_APP_URL)' },
        { status: 500 }
      );
    }

    // Generate CSRF protection token
    const state = generateStateToken();

    // Build redirect URI (must match Google Console configuration)
    const redirectUri = `${appUrl}/auth/callback`;

    // Build Google OAuth URL
    const authUrl = buildAuthorizationUrl(clientId, redirectUri, state);

    // Store state in httpOnly cookie for verification in callback
    // Cookie expires in 10 minutes (OAuth flow should complete quickly)
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/auth',
    });

    // Redirect to Google for authorization
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
