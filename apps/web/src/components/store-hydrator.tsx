'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/stores';

interface StoreHydratorProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
}

/**
 * StoreHydrator
 * Client component that hydrates Zustand stores with server-side data
 * Should be mounted once at the top of the app layout
 */
export function StoreHydrator({ user, tenant }: StoreHydratorProps) {
  const setUser = useUserStore((state) => state.setUser);
  const setTenant = useUserStore((state) => state.setTenant);

  useEffect(() => {
    setUser(user);
    setTenant(tenant);
  }, [user, tenant, setUser, setTenant]);

  return null;
}
