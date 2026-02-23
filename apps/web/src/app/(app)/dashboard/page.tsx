'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserStore } from '@/stores';
import {
  Building2,
  Handshake,
  Ticket,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';

// Mock data for dashboard
const mockStats = {
  organizations: { total: 3, change: '+12%', trend: 'up' },
  deals: { total: 3, value: 800000, change: '+23%', trend: 'up' },
  tickets: { total: 4, open: 2, change: '-8%', trend: 'down' },
  contacts: { total: 4, active: 3, change: '+5%', trend: 'up' },
};

const mockRecentDeals = [
  {
    id: '1',
    name: 'Enterprise Software License',
    organization: 'Acme Corporation',
    amount: 250000,
    stage: 'Negotiation',
    probability: 75,
  },
  {
    id: '2',
    name: 'Manufacturing Equipment',
    organization: 'Global Industries',
    amount: 500000,
    stage: 'Proposal',
    probability: 50,
  },
  {
    id: '3',
    name: 'Consulting Services',
    organization: 'StartUp Inc',
    amount: 50000,
    stage: 'Qualification',
    probability: 25,
  },
];

const mockRecentTickets = [
  {
    id: '1',
    title: 'Login Issues on Mobile App',
    status: 'open',
    priority: 'high',
    organization: 'Acme Corporation',
  },
  {
    id: '2',
    title: 'Feature Request: Dark Mode',
    status: 'in_progress',
    priority: 'medium',
    organization: 'Global Industries',
  },
  {
    id: '3',
    title: 'Data Export Not Working',
    status: 'resolved',
    priority: 'urgent',
    organization: 'StartUp Inc',
  },
];

const mockActivities = [
  {
    id: '1',
    type: 'deal_created',
    description: 'New deal created: Enterprise Software License',
    time: '2 hours ago',
  },
  {
    id: '2',
    type: 'ticket_resolved',
    description: 'Ticket resolved: Data Export Not Working',
    time: '4 hours ago',
  },
  {
    id: '3',
    type: 'organization_added',
    description: 'New organization added: StartUp Inc',
    time: '1 day ago',
  },
];

const stageColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Lead: 'outline',
  Qualification: 'secondary',
  Proposal: 'default',
  Negotiation: 'default',
  'Closed Won': 'secondary',
  'Closed Lost': 'destructive',
};

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'destructive',
  in_progress: 'default',
  resolved: 'secondary',
  closed: 'outline',
};

const priorityColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'outline',
  medium: 'default',
  high: 'secondary',
  urgent: 'destructive',
};

/**
 * Dashboard Page
 * Main overview page with role-based widgets and analytics
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user, hasPermission } = useUserStore();

  const canManageOrganizations = hasPermission('organizations:write');
  const canManageDeals = hasPermission('deals:write');
  const canManageTickets = hasPermission('tickets:write');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user?.name || 'User'}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.organizations.total}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {mockStats.organizations.trend === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span
                className={
                  mockStats.organizations.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }
              >
                {mockStats.organizations.change}
              </span>
              <span>from last month</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.deals.total}</div>
            <p className="text-xs text-muted-foreground">
              ${(mockStats.deals.value / 1000).toFixed(0)}K in pipeline
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-green-600">{mockStats.deals.change}</span>
              <span>from last month</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.tickets.open}</div>
            <p className="text-xs text-muted-foreground">
              {mockStats.tickets.total} total tickets
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-green-600" />
              <span className="text-green-600">{mockStats.tickets.change}</span>
              <span>from last month</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.contacts.active}</div>
            <p className="text-xs text-muted-foreground">
              {mockStats.contacts.total} total contacts
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-green-600">{mockStats.contacts.change}</span>
              <span>from last month</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Only show if user has permissions */}
      {(canManageOrganizations || canManageDeals || canManageTickets) && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you can perform</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canManageOrganizations && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/organizations')}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Organization
              </Button>
            )}
            {canManageDeals && (
              <Button variant="outline" size="sm" onClick={() => router.push('/deals')}>
                <Plus className="h-4 w-4 mr-2" />
                New Deal
              </Button>
            )}
            {canManageTickets && (
              <Button variant="outline" size="sm" onClick={() => router.push('/tickets')}>
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push('/contacts')}>
              <Plus className="h-4 w-4 mr-2" />
              New Contact
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Deals */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Deals</CardTitle>
            <CardDescription>Latest opportunities in your pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                  onClick={() => router.push(`/deals/${deal.id}`)}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-none">{deal.name}</p>
                      <Badge variant={stageColors[deal.stage] || 'default'} className="text-xs">
                        {deal.stage}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{deal.organization}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">${(deal.amount / 1000).toFixed(0)}K</p>
                    <p className="text-xs text-muted-foreground">{deal.probability}%</p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-4"
              onClick={() => router.push('/deals')}
            >
              View All Deals
            </Button>
          </CardContent>
        </Card>

        {/* Recent Tickets */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Tickets</CardTitle>
            <CardDescription>Latest support issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-none">{ticket.title}</p>
                      <Badge
                        variant={priorityColors[ticket.priority] || 'default'}
                        className="text-xs"
                      >
                        {ticket.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{ticket.organization}</p>
                  </div>
                  <Badge variant={statusColors[ticket.status] || 'default'} className="text-xs">
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-4"
              onClick={() => router.push('/tickets')}
            >
              View All Tickets
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity - Only show if admin */}
      {hasPermission('admin:read') && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {activity.type === 'deal_created' && (
                      <Handshake className="h-4 w-4 text-blue-600" />
                    )}
                    {activity.type === 'ticket_resolved' && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {activity.type === 'organization_added' && (
                      <Building2 className="h-4 w-4 text-purple-600" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
