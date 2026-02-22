/**
 * Google OAuth Helper Functions
 * Implements OAuth 2.0 flow for Google authentication
 */

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

export interface GoogleUserProfile {
  sub: string; // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Build Google OAuth authorization URL
 * @param clientId - Google OAuth client ID
 * @param redirectUri - Callback URL after authorization
 * @param state - CSRF protection token
 * @returns Authorization URL to redirect user to
 */
export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline'); // Request refresh token
  url.searchParams.set('prompt', 'consent'); // Force consent screen for refresh token

  return url.toString();
}

/**
 * Exchange authorization code for access tokens
 * @param code - Authorization code from Google callback
 * @param redirectUri - Same redirect URI used in authorization request
 * @param clientId - Google OAuth client ID
 * @param clientSecret - Google OAuth client secret
 * @returns Token response with access_token and id_token
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to exchange code for tokens: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch user profile from Google using access token
 * @param accessToken - Google access token
 * @returns User profile information
 */
export async function fetchUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch user profile: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Generate a cryptographically secure random state token for CSRF protection
 * @returns Random state token (base64url encoded)
 */
export function generateStateToken(): string {
  // Generate 32 random bytes and encode as base64url
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to base64url (URL-safe base64)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
