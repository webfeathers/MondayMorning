import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, fetchUserProfile } from '@/lib/oauth/google';
import { cookies } from 'next/headers';
import { db, users, tenants, tenantMembers } from '@wf/db';
import { eq, and } from 'drizzle-orm';
import { createSession, signCookie } from '@wf/auth';
import { provisionTenant } from '@wf/billing';

/**
 * GET /auth/callback
 * Handles OAuth callback from Google
 * - Verifies state parameter
 * - Exchanges authorization code for tokens
 * - Fetches user profile
 * - Creates or finds user in database
 * - Creates session with signed cookie
 * - Redirects to dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors (user denied access, etc.)
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Verify required parameters
    if (!code) {
      return NextResponse.redirect(
        new URL('/login?error=missing_code', request.url)
      );
    }

    if (!state) {
      return NextResponse.redirect(
        new URL('/login?error=missing_state', request.url)
      );
    }

    // Verify state parameter (CSRF protection)
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state')?.value;

    if (!storedState || storedState !== state) {
      console.error('State mismatch:', { stored: storedState, received: state });
      return NextResponse.redirect(
        new URL('/login?error=invalid_state', request.url)
      );
    }

    // Clear state cookie (one-time use)
    cookieStore.delete('oauth_state');

    // Get configuration
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth configuration');
      return NextResponse.redirect(
        new URL('/login?error=configuration_error', request.url)
      );
    }

    if (!appUrl) {
      console.error('Missing application URL configuration');
      return NextResponse.redirect(
        new URL('/login?error=configuration_error', request.url)
      );
    }

    const redirectUri = `${appUrl}/auth/callback`;

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      redirectUri,
      clientId,
      clientSecret
    );

    // Fetch user profile from Google
    const profile = await fetchUserProfile(tokens.access_token);

    // Find or create user in database
    let user = await db.query.users.findFirst({
      where: eq(users.email, profile.email),
    });

    if (!user) {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture,
          authProvider: 'google',
          authProviderId: profile.sub,
          lastLoginAt: new Date(),
        })
        .returning();

      user = newUser;
    } else {
      // Update existing user's last login and profile info
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          name: profile.name,
          avatarUrl: profile.picture,
          authProviderId: profile.sub,
        })
        .where(eq(users.id, user.id));
    }

    // Get tenant ID from middleware-injected headers
    const tenantId = request.headers.get('X-Tenant-Id');

    if (!tenantId) {
      console.error('Missing tenant ID from middleware headers');
      return NextResponse.redirect(
        new URL('/login?error=missing_tenant', request.url)
      );
    }

    // Check if this is a new tenant (no existing members means new tenant needing provisioning)
    const existingMember = await db.query.tenantMembers.findFirst({
      where: eq(tenantMembers.tenantId, tenantId),
    });

    // If this is a new tenant (first member), provision billing
    if (!existingMember) {
      try {
        // Get tenant details for provisioning
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, tenantId),
        });

        if (tenant) {
          // Provision tenant with Stripe customer and trial subscription
          await provisionTenant(
            tenant.id,
            tenant.name,
            profile.email, // Owner email
            'pro' // Default to Pro plan with 14-day trial
          );

          console.log('Tenant provisioned successfully:', {
            tenantId: tenant.id,
            tenantName: tenant.name,
          });
        }
      } catch (provisionError) {
        // Log error but don't block signup - billing can be fixed later
        console.error('Error provisioning tenant:', provisionError);
        // Could add a flag to tenant or send alert to admin
      }
    }

    // Create session with metadata
    const sessionSigningSecret = process.env.SESSION_SIGNING_SECRET;
    if (!sessionSigningSecret) {
      console.error('Missing SESSION_SIGNING_SECRET');
      return NextResponse.redirect(
        new URL('/login?error=configuration_error', request.url)
      );
    }

    const { token } = await createSession(user.id, tenantId, {
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Sign the session token cookie
    const signedToken = signCookie(token, sessionSigningSecret);

    // Set httpOnly cookie with signed session token
    cookieStore.set('session', signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 14, // 14 days (matches SESSION_DURATION_MS)
      path: '/',
    });

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error in OAuth callback:', error);

    // Differentiate between Google API errors and our errors
    const errorMessage =
      error instanceof Error ? error.message : 'authentication_failed';

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
