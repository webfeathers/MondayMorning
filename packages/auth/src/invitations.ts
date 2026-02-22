import { createSessionToken, hashToken } from './session';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tenantMembers, users, tenants } from '@wf/db';
import { eq, and } from 'drizzle-orm';

const INVITATION_EXPIRY_DAYS = 7;

interface CreateInvitationResult {
  token: string;
  invitationId: string;
  email: string;
  role: string;
  tenantId: string;
}

interface InvitationDetails {
  email: string;
  tenantId: string;
  tenantName: string;
  role: string;
  invitedBy: string;
  inviterName: string;
  expiresAt: Date;
  memberId: string;
}

interface AcceptInvitationResult {
  success: boolean;
  memberId?: string;
  joinedAt?: Date;
  error?: string;
}

/**
 * Creates an invitation for a new team member
 * @param email - Email address of the person being invited
 * @param tenantId - ID of the tenant/organization
 * @param role - Role to assign (owner, admin, member)
 * @param invitedBy - ID of the user creating the invitation
 * @returns Invitation token and details
 */
export async function createInvitation(
  email: string,
  tenantId: string,
  role: string,
  invitedBy: string
): Promise<CreateInvitationResult> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema: { tenantMembers, users, tenants } });

  try {
    // Generate unique invitation token
    const token = createSessionToken();
    const tokenHash = hashToken(token);

    // Create tenant_member record with 'invited' status
    const [member] = await db
      .insert(tenantMembers)
      .values({
        tenantId,
        email,
        role,
        invitedBy,
        invitationTokenHash: tokenHash,
        invitationCreatedAt: new Date(),
        status: 'invited',
      })
      .returning({
        id: tenantMembers.id,
        email: tenantMembers.email,
        role: tenantMembers.role,
        tenantId: tenantMembers.tenantId,
      });

    return {
      token,
      invitationId: member.id,
      email: member.email!,
      role: member.role,
      tenantId: member.tenantId,
    };
  } finally {
    await sql.end();
  }
}

/**
 * Validates an invitation token and returns invitation details
 * @param token - The invitation token to validate
 * @returns Invitation details if valid and not expired, null otherwise
 */
export async function validateInvitationToken(
  token: string
): Promise<InvitationDetails | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema: { tenantMembers, users, tenants } });

  try {
    const tokenHash = hashToken(token);

    // Find invitation by token hash
    const [invitation] = await db
      .select({
        memberId: tenantMembers.id,
        email: tenantMembers.email,
        tenantId: tenantMembers.tenantId,
        tenantName: tenants.name,
        role: tenantMembers.role,
        invitedBy: tenantMembers.invitedBy,
        inviterName: users.name,
        invitationCreatedAt: tenantMembers.invitationCreatedAt,
        status: tenantMembers.status,
      })
      .from(tenantMembers)
      .leftJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .leftJoin(users, eq(tenantMembers.invitedBy, users.id))
      .where(
        and(
          eq(tenantMembers.invitationTokenHash, tokenHash),
          eq(tenantMembers.status, 'invited')
        )
      )
      .limit(1);

    if (!invitation) {
      return null;
    }

    // Check if invitation has expired (7 days)
    const expiresAt = new Date(invitation.invitationCreatedAt!);
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    if (new Date() > expiresAt) {
      return null;
    }

    return {
      email: invitation.email!,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenantName || 'Unknown Organization',
      role: invitation.role,
      invitedBy: invitation.invitedBy!,
      inviterName: invitation.inviterName || 'Unknown User',
      expiresAt,
      memberId: invitation.memberId,
    };
  } finally {
    await sql.end();
  }
}

/**
 * Accepts an invitation and activates the membership
 * @param token - The invitation token
 * @param userId - The ID of the user accepting the invitation
 * @returns Success status and membership details
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<AcceptInvitationResult> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema: { tenantMembers, users, tenants } });

  try {
    // Validate the invitation first
    const invitation = await validateInvitationToken(token);

    if (!invitation) {
      return {
        success: false,
        error: 'Invalid or expired invitation token',
      };
    }

    // Check if invitation has already been accepted
    const [existingMember] = await db
      .select()
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.id, invitation.memberId),
          eq(tenantMembers.status, 'active')
        )
      )
      .limit(1);

    if (existingMember) {
      return {
        success: false,
        error: 'Invitation has already been accepted',
      };
    }

    // Update the tenant_member record
    const joinedAt = new Date();
    const [updatedMember] = await db
      .update(tenantMembers)
      .set({
        userId,
        status: 'active',
        joinedAt,
        invitationTokenHash: null, // Clear the token hash after acceptance
        updatedAt: new Date(),
      })
      .where(eq(tenantMembers.id, invitation.memberId))
      .returning({
        id: tenantMembers.id,
        joinedAt: tenantMembers.joinedAt,
      });

    return {
      success: true,
      memberId: updatedMember.id,
      joinedAt: updatedMember.joinedAt || undefined,
    };
  } finally {
    await sql.end();
  }
}
