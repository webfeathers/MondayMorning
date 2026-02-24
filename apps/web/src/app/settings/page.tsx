/**
 * Settings Overview Page
 */

'use client';

import Link from 'next/link';
import { Settings, Users, CreditCard, Plug, Bell, FileText } from 'lucide-react';

const settingsPages = [
  {
    name: 'Members',
    description: 'Manage team members and permissions',
    href: '/settings/members',
    icon: Users,
  },
  {
    name: 'Billing',
    description: 'View plan, usage, and invoices',
    href: '/settings/billing',
    icon: CreditCard,
  },
  {
    name: 'Integrations',
    description: 'Connect CRM and other tools',
    href: '/settings/integrations',
    icon: Plug,
  },
  {
    name: 'Notifications',
    description: 'Configure notification preferences',
    href: '/settings/notifications',
    icon: Bell,
  },
  {
    name: 'Audit Log',
    description: 'View security and compliance logs',
    href: '/settings/audit',
    icon: FileText,
  },
];

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-600">Manage your workspace settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsPages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <page.icon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">{page.name}</h3>
                <p className="text-sm text-gray-600">{page.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
