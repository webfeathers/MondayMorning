import { NextRequest, NextResponse } from 'next/server';
import { validateInvitationToken } from '@wf/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Validate the invitation token
    const invitation = await validateInvitationToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    // Return invitation details (without sensitive info like token hash)
    return NextResponse.json({
      email: invitation.email,
      tenantName: invitation.tenantName,
      role: invitation.role,
      inviterName: invitation.inviterName,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to validate invitation' },
      { status: 500 }
    );
  }
}
