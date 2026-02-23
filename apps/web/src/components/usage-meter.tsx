'use client';

import { useUserStore } from '@/stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Users, Zap, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * UsageMeter Component
 * Displays current usage for seats and credits with visual progress bars
 */
export function UsageMeter() {
  const { entitlements } = useUserStore();

  if (!entitlements) {
    return null;
  }

  const { seats, credits } = entitlements;
  const seatPercentage = (seats.current / seats.max) * 100;
  const creditPercentage = credits.unlimited
    ? 0
    : (credits.used / credits.allocated) * 100;

  const isSeatsNearLimit = seatPercentage >= 80;
  const isCreditsNearLimit = !credits.unlimited && creditPercentage >= 80;

  return (
    <div className="space-y-4">
      {/* Seats Usage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Team Seats</CardTitle>
            </div>
            <span className="text-sm text-muted-foreground">
              {seats.current} / {seats.max}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={seatPercentage} className="h-2" />
          {isSeatsNearLimit && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                You're approaching your seat limit. Consider upgrading your plan.
              </AlertDescription>
            </Alert>
          )}
          {seats.canAddMore && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => (window.location.href = '/settings')}
            >
              Add More Seats
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Credits Usage */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">API Credits</CardTitle>
            </div>
            {credits.unlimited ? (
              <span className="text-sm text-muted-foreground">Unlimited</span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {credits.remaining.toLocaleString()} remaining
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!credits.unlimited && (
            <>
              <Progress value={creditPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {credits.used.toLocaleString()} of {credits.allocated.toLocaleString()} used
              </p>
              {isCreditsNearLimit && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    You're running low on API credits. Upgrade for more credits.
                  </AlertDescription>
                </Alert>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => (window.location.href = '/settings')}
              >
                Buy More Credits
              </Button>
            </>
          )}
          {credits.unlimited && (
            <p className="text-xs text-muted-foreground">
              Your plan includes unlimited API credits.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Compact version for sidebars or small spaces
 */
export function UsageMeterCompact() {
  const { entitlements } = useUserStore();

  if (!entitlements) {
    return null;
  }

  const { seats, credits } = entitlements;
  const seatPercentage = (seats.current / seats.max) * 100;
  const creditPercentage = credits.unlimited
    ? 0
    : (credits.used / credits.allocated) * 100;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      {/* Seats */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Seats</span>
          <span className="font-medium">
            {seats.current}/{seats.max}
          </span>
        </div>
        <Progress value={seatPercentage} className="h-1.5" />
      </div>

      {/* Credits */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Credits</span>
          {credits.unlimited ? (
            <span className="font-medium">∞</span>
          ) : (
            <span className="font-medium">{credits.remaining.toLocaleString()}</span>
          )}
        </div>
        {!credits.unlimited && <Progress value={creditPercentage} className="h-1.5" />}
      </div>
    </div>
  );
}
