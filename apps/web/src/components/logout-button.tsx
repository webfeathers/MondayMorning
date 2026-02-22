'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * LogoutButton Component
 * Client-side button that calls /api/auth/logout
 * - Handles loading state during logout
 * - Calls API route to revoke session
 * - Redirects to login page
 */
export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      // Redirect to login page (from response or default)
      const redirectUrl = data.redirectUrl || '/login';
      router.push(redirectUrl);
    } catch (error) {
      console.error('Logout failed:', error);
      // Redirect to login anyway
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </Button>
  );
}
