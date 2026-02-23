'use client';

import { ReactNode } from 'react';
import { useUserStore } from '@/stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface FeatureGateProps {
  feature: 'configurableDashboards' | 'webhookSync' | 'whiteLabel' | 'apiAccess';
  children: ReactNode;
  fallback?: ReactNode;
  upgradeMessage?: string;
}

/**
 * FeatureGate Component
 * Conditionally renders content based on feature entitlements
 * Shows upgrade prompt if feature is not available
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  upgradeMessage,
}: FeatureGateProps) {
  const { hasFeature, entitlements } = useUserStore();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle>Feature Locked</CardTitle>
        <CardDescription>
          {upgradeMessage ||
            `This feature requires a plan upgrade. Your current plan does not include ${feature}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button onClick={() => window.location.href = '/settings'}>
          Upgrade Plan
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Hook to check if a feature is available
 */
export function useFeatureGate(feature: Parameters<typeof FeatureGate>[0]['feature']) {
  const { hasFeature } = useUserStore();
  return hasFeature(feature);
}
