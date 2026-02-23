'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityTable } from '@/components/entity-table';
import { EntityFormDialog, FormFieldDefinition } from '@/components/entity-form-dialog';
import { CustomFieldRenderer } from '@/components/custom-field-renderer';
import { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useFilterStore } from '@/stores';
import { Ticket } from 'lucide-react';

// Mock data for demonstration
const mockTickets = [
  {
    id: '1',
    title: 'Login Issues on Mobile App',
    status: 'open',
    priority: 'high',
    organization: 'Acme Corporation',
    assignee: 'John Doe',
    createdAt: '2024-02-20T09:00:00Z',
  },
  {
    id: '2',
    title: 'Feature Request: Dark Mode',
    status: 'in_progress',
    priority: 'medium',
    organization: 'Global Industries',
    assignee: 'Jane Smith',
    createdAt: '2024-02-19T14:30:00Z',
  },
  {
    id: '3',
    title: 'Data Export Not Working',
    status: 'resolved',
    priority: 'urgent',
    organization: 'StartUp Inc',
    assignee: 'Bob Johnson',
    createdAt: '2024-02-18T11:15:00Z',
  },
  {
    id: '4',
    title: 'API Rate Limit Question',
    status: 'closed',
    priority: 'low',
    organization: 'Acme Corporation',
    assignee: 'John Doe',
    createdAt: '2024-02-15T16:45:00Z',
  },
];

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

const columns: Column<typeof mockTickets[0]>[] = [
  {
    key: 'title',
    header: 'Title',
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.title}</span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => (
      <Badge variant={statusColors[row.status] || 'default'}>
        {row.status.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    key: 'priority',
    header: 'Priority',
    sortable: true,
    render: (row) => (
      <Badge variant={priorityColors[row.priority] || 'default'}>{row.priority}</Badge>
    ),
  },
  {
    key: 'organization',
    header: 'Organization',
    sortable: true,
  },
  {
    key: 'assignee',
    header: 'Assignee',
    sortable: true,
  },
  {
    key: 'createdAt',
    header: 'Created',
    sortable: true,
    render: (row) => <CustomFieldRenderer value={row.createdAt} type="date" />,
  },
];

const formFields: FormFieldDefinition[] = [
  {
    key: 'title',
    label: 'Title',
    type: 'text',
    required: true,
    placeholder: 'Brief description of the issue',
  },
  {
    key: 'organization',
    label: 'Organization',
    type: 'text',
    required: true,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { label: 'Open', value: 'open' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Resolved', value: 'resolved' },
      { label: 'Closed', value: 'closed' },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    required: true,
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Medium', value: 'medium' },
      { label: 'High', value: 'high' },
      { label: 'Urgent', value: 'urgent' },
    ],
  },
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'text',
  },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Detailed description of the issue...',
  },
];

/**
 * Tickets List Page
 * Shows all tickets with filtering, search, status filtering, and CRUD operations
 */
export default function TicketsPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const {
    ticketsSearch,
    ticketsPage,
    ticketsSort,
    ticketsStatusFilter,
    setTicketsSearch,
    setTicketsPage,
    setTicketsSort,
    setTicketsStatusFilter,
  } = useFilterStore();

  // Filter data
  let filteredData = mockTickets.filter((ticket) =>
    ticket.title.toLowerCase().includes(ticketsSearch.toLowerCase())
  );

  if (ticketsStatusFilter) {
    filteredData = filteredData.filter((ticket) => ticket.status === ticketsStatusFilter);
  }

  const handleSort = (key: string) => {
    const newDirection =
      ticketsSort?.field === key && ticketsSort?.direction === 'asc' ? 'desc' : 'asc';
    setTicketsSort(key, newDirection);
  };

  const handleRowClick = (row: typeof mockTickets[0]) => {
    router.push(`/tickets/${row.id}`);
  };

  const handleCreateTicket = async (data: Record<string, any>) => {
    console.log('Creating ticket:', data);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
        <p className="text-muted-foreground">
          Manage support tickets and customer issues.
        </p>
      </div>

      <EntityTable
        columns={columns}
        data={filteredData}
        loading={false}
        page={ticketsPage}
        pageSize={20}
        total={filteredData.length}
        onPageChange={setTicketsPage}
        sortBy={ticketsSort?.field || null}
        sortDirection={ticketsSort?.direction || 'asc'}
        onSort={handleSort}
        onRowClick={handleRowClick}
        searchValue={ticketsSearch}
        onSearchChange={setTicketsSearch}
        searchPlaceholder="Search tickets..."
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: ticketsStatusFilter,
            options: [
              { label: 'Open', value: 'open' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Resolved', value: 'resolved' },
              { label: 'Closed', value: 'closed' },
            ],
            onChange: setTicketsStatusFilter,
          },
        ]}
        onCreateNew={() => setCreateDialogOpen(true)}
        createLabel="New Ticket"
        emptyMessage="No tickets found. Create your first ticket to get started."
      />

      <EntityFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Ticket"
        description="Create a new support ticket."
        fields={formFields}
        onSubmit={handleCreateTicket}
        submitLabel="Create"
      />
    </div>
  );
}
