'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface InvitationDetails {
  email: string;
  tenantName: string;
  role: string;
  inviterName: string;
  expiresAt: string;
}

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      try {
        const response = await fetch(`/api/invitations/${token}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load invitation');
        }

        const data = await response.json();
        setInvitation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invitation');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadInvitation();
    }
  }, [token]);

  async function handleAcceptInvitation() {
    setAccepting(true);
    setError(null);

    try {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const data = await response.json();

      // Redirect to the tenant dashboard
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">
              Invalid Invitation
            </h2>
            <p className="mt-2 text-gray-600">
              {error || 'This invitation link is invalid or has expired.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const expiresAt = new Date(invitation.expiresAt);
  const isExpired = expiresAt < new Date();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            You've been invited!
          </h2>

          <div className="mt-6 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Organization</p>
              <p className="text-lg font-semibold text-gray-900">
                {invitation.tenantName}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Invited by</p>
              <p className="text-lg font-semibold text-gray-900">
                {invitation.inviterName}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Role</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {invitation.role}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-lg font-semibold text-gray-900">
                {invitation.email}
              </p>
            </div>

            <div className="text-xs text-gray-500">
              Expires: {expiresAt.toLocaleDateString()} at{' '}
              {expiresAt.toLocaleTimeString()}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleAcceptInvitation}
              disabled={accepting || isExpired}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                accepting || isExpired
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {accepting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Accepting...
                </>
              ) : isExpired ? (
                'Invitation Expired'
              ) : (
                'Accept Invitation'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
