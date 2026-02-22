import { NextRequest, NextResponse } from 'next/server';
import { createInvitation } from '@wf/auth';
import { getSession } from '@/lib/session';
import { getTenant } from '@/lib/get-tenant';
import { hasPermission } from '@wf/auth';
import { createTenantClient } from '@wf/db';

export async function POST(request: NextRequest) {
  try {
    // 1. Validate session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get tenant from subdomain
    const tenant = await getTenant();
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // 3. Check permission: 'members:invite'
    const dbClient = createTenantClient(tenant.id);
    const canInvite = await hasPermission(
      dbClient.db,
      session.userId,
      tenant.id,
      'members:invite'
    );

    if (!canInvite) {
      return NextResponse.json(
        { error: 'Permission denied: members:invite' },
        { status: 403 }
      );
    }

    // 4. Parse request body
    const body = await request.json();
    const { email, role = 'member' } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'member'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: owner, admin, member' },
        { status: 400 }
      );
    }

    // 5. Create invitation
    const invitation = await createInvitation(
      email,
      tenant.id,
      role,
      session.userId
    );

    // 6. Generate invitation URL
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const invitationUrl = `${protocol}://${host}/invitations/${invitation.token}`;

    // 7. Log invitation URL (in production, this would send an email)
    console.log(`
      ==============================================
      INVITATION CREATED
      ==============================================
      To: ${email}
      Role: ${role}
      Tenant: ${tenant.name}
      Invitation URL: ${invitationUrl}
      ==============================================
    `);

    // 8. Return success response
    return NextResponse.json({
      success: true,
      invitationId: invitation.invitationId,
      email: invitation.email,
      role: invitation.role,
      invitationUrl, // Include URL in response for testing
      message: 'Invitation created successfully. In production, an email would be sent.',
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}
