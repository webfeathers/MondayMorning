import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitation, validateInvitationToken, createSession } from '@wf/auth';
import { getSession } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // 1. Validate invitation token first
    const invitation = await validateInvitationToken(token);
    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      );
    }

    // 2. Check if user is authenticated
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'You must be logged in to accept an invitation' },
        { status: 401 }
      );
    }

    // 3. Accept the invitation
    const result = await acceptInvitation(token, session.userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to accept invitation' },
        { status: 400 }
      );
    }

    // 4. Create a new session for the user in the invited tenant
    const newSession = await createSession(
      session.userId,
      invitation.tenantId,
      {
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      }
    );

    // 5. Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('session', newSession.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 14 * 24 * 60 * 60, // 14 days
      path: '/',
    });

    // 6. Return success response
    return NextResponse.json({
      success: true,
      memberId: result.memberId,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenantName,
      message: 'Invitation accepted successfully',
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
