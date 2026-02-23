'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UsageMeter } from '@/components/usage-meter';
import { FeatureGate } from '@/components/feature-gate';
import { useUserStore } from '@/stores';
import { Check, X, Crown } from 'lucide-react';

/**
 * Settings Page
 * Application and account settings with usage and plan information
 */
export default function SettingsPage() {
  const { tenant, entitlements } = useUserStore();

  const features = [
    {
      key: 'configurableDashboards',
      name: 'Configurable Dashboards',
      description: 'Customize your dashboard layout and widgets',
    },
    {
      key: 'webhookSync',
      name: 'Webhook Sync',
      description: 'Real-time data synchronization via webhooks',
    },
    {
      key: 'whiteLabel',
      name: 'White Label',
      description: 'Custom branding and domain',
    },
    {
      key: 'apiAccess',
      name: 'API Access',
      description: 'Programmatic access to your data',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application settings and preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Settings Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Workspace</p>
                    <p className="text-sm text-muted-foreground">{tenant?.name || 'N/A'}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Workspace Slug</p>
                    <p className="text-sm text-muted-foreground">{tenant?.slug || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plan Features */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Plan Features</CardTitle>
                  <CardDescription>Features included in your current plan</CardDescription>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Pro Plan
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {features.map((feature) => {
                  const hasFeature = entitlements?.features[feature.key] ?? false;
                  return (
                    <div
                      key={feature.key}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="mt-0.5">
                        {hasFeature ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                            <Check className="h-3 w-3 text-green-600" />
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
                            <X className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{feature.name}</p>
                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                      {!hasFeature && (
                        <Badge variant="outline" className="text-xs">
                          Upgrade
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button className="w-full">Upgrade Plan</Button>
              </div>
            </CardContent>
          </Card>

          {/* API Access Section with Feature Gate */}
          <FeatureGate
            feature="apiAccess"
            upgradeMessage="API access requires a Business or Enterprise plan. Upgrade to access our REST API and programmatic integrations."
          >
            <Card>
              <CardHeader>
                <CardTitle>API Access</CardTitle>
                <CardDescription>Manage API keys and access tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  API keys allow you to authenticate and access your data programmatically.
                </p>
                <Button variant="outline">Generate API Key</Button>
              </CardContent>
            </Card>
          </FeatureGate>

          {/* Integrations */}
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect external services</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Integration settings managed through API routes.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* Usage Meters */}
          <UsageMeter />

          {/* Billing Card */}
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Manage your subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full">
                Billing Portal
              </Button>
              <p className="text-xs text-muted-foreground">
                Manage payment methods, view invoices, and update billing information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
