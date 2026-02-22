import { createSessionToken, hashToken } from './session';
import { createTenantClient, sessions, db } from '@wf/db';
import { SESSION_DURATION_MS } from '@wf/shared';
import { eq, and, lt } from 'drizzle-orm';

export interface SessionData {
  sessionId: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
  lastActiveAt: Date;
}

export interface CreateSessionResult {
  token: string;
  sessionId: string;
}

/**
 * Creates a new session for a user
 * @param userId - The user's UUID
 * @param tenantId - The tenant's UUID
 * @param metadata - Optional metadata (IP address, user agent)
 * @returns The plaintext token and session ID
 */
export async function createSession(
  userId: string,
  tenantId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<CreateSessionResult> {
  // Generate plaintext token
  const token = createSessionToken();

  // Hash token for storage
  const tokenHash = hashToken(token);

  // Calculate expiration
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Create tenant client
  const client = createTenantClient(tenantId);

  // Insert session
  const [session] = await client.withTenantContext(async (tx) => {
    return tx
      .insert(sessions)
      .values({
        userId,
        tenantId,
        tokenHash,
        expiresAt,
        lastActiveAt: new Date(),
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      })
      .returning({ id: sessions.id });
  });

  return {
    token, // Return plaintext token to caller
    sessionId: session.id,
  };
}

/**
 * Validates a session token and returns session data
 * @param token - The plaintext session token
 * @returns Session data if valid, null if expired or revoked
 */
export async function validateSession(token: string): Promise<SessionData | null> {
  // Hash the token for lookup
  const tokenHash = hashToken(token);

  // Find session by token hash (using base db client without tenant isolation)
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (!session) {
    return null;
  }

  // Check if session is revoked
  if (session.revokedAt) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    return null;
  }

  // Check if we need to refresh lastActiveAt (sliding window)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (session.lastActiveAt < oneHourAgo) {
    // Update lastActiveAt in background (don't await)
    refreshSession(session.id).catch(console.error);
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    tenantId: session.tenantId,
    expiresAt: session.expiresAt,
    lastActiveAt: session.lastActiveAt,
  };
}

/**
 * Revokes a session by setting revokedAt timestamp
 * @param sessionId - The session UUID to revoke
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/**
 * Refreshes a session's lastActiveAt timestamp (sliding window)
 * Only updates if lastActiveAt is more than 1 hour old
 * @param sessionId - The session UUID to refresh
 */
export async function refreshSession(sessionId: string): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  await db
    .update(sessions)
    .set({ lastActiveAt: new Date() })
    .where(
      and(
        eq(sessions.id, sessionId),
        lt(sessions.lastActiveAt, oneHourAgo)
      )
    );
}
