'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityTable } from '@/components/entity-table';
import { EntityFormDialog, FormFieldDefinition } from '@/components/entity-form-dialog';
import { CustomFieldRenderer } from '@/components/custom-field-renderer';
import { Column } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { useFilterStore } from '@/stores';
import { Handshake } from 'lucide-react';

// Mock data for demonstration
const mockDeals = [
  {
    id: '1',
    name: 'Enterprise Software License',
    organization: 'Acme Corporation',
    stage: 'Negotiation',
    amount: 250000,
    probability: 75,
    closeDate: '2024-03-30',
    owner: 'John Doe',
    createdAt: '2024-02-01T10:00:00Z',
  },
  {
    id: '2',
    name: 'Manufacturing Equipment',
    organization: 'Global Industries',
    stage: 'Proposal',
    amount: 500000,
    probability: 50,
    closeDate: '2024-04-15',
    owner: 'Jane Smith',
    createdAt: '2024-02-10T14:30:00Z',
  },
  {
    id: '3',
    name: 'Consulting Services',
    organization: 'StartUp Inc',
    stage: 'Qualification',
    amount: 50000,
    probability: 25,
    closeDate: '2024-03-15',
    owner: 'Bob Johnson',
    createdAt: '2024-02-15T09:15:00Z',
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

const columns: Column<typeof mockDeals[0]>[] = [
  {
    key: 'name',
    header: 'Deal Name',
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        <Handshake className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.name}</span>
      </div>
    ),
  },
  {
    key: 'organization',
    header: 'Organization',
    sortable: true,
  },
  {
    key: 'stage',
    header: 'Stage',
    sortable: true,
    render: (row) => (
      <Badge variant={stageColors[row.stage] || 'default'}>{row.stage}</Badge>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    render: (row) => `$${row.amount.toLocaleString()}`,
  },
  {
    key: 'probability',
    header: 'Probability',
    sortable: true,
    render: (row) => `${row.probability}%`,
  },
  {
    key: 'closeDate',
    header: 'Close Date',
    sortable: true,
    render: (row) => <CustomFieldRenderer value={row.closeDate} type="date" />,
  },
];

const formFields: FormFieldDefinition[] = [
  {
    key: 'name',
    label: 'Deal Name',
    type: 'text',
    required: true,
    placeholder: 'Enterprise Software License',
  },
  {
    key: 'organization',
    label: 'Organization',
    type: 'text',
    required: true,
  },
  {
    key: 'stage',
    label: 'Stage',
    type: 'select',
    required: true,
    options: [
      { label: 'Lead', value: 'Lead' },
      { label: 'Qualification', value: 'Qualification' },
      { label: 'Proposal', value: 'Proposal' },
      { label: 'Negotiation', value: 'Negotiation' },
      { label: 'Closed Won', value: 'Closed Won' },
      { label: 'Closed Lost', value: 'Closed Lost' },
    ],
  },
  {
    key: 'amount',
    label: 'Amount',
    type: 'number',
    required: true,
    placeholder: '250000',
  },
  {
    key: 'probability',
    label: 'Probability (%)',
    type: 'number',
    placeholder: '75',
  },
  {
    key: 'closeDate',
    label: 'Expected Close Date',
    type: 'date',
    required: true,
  },
  {
    key: 'owner',
    label: 'Deal Owner',
    type: 'text',
  },
];

/**
 * Deals List Page
 * Shows all deals with filtering, search, stage filtering, and CRUD operations
 */
export default function DealsPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const {
    dealsSearch,
    dealsPage,
    dealsSort,
    dealsStageFilter,
    setDealsSearch,
    setDealsPage,
    setDealsSort,
    setDealsStageFilter,
  } = useFilterStore();

  // Filter data
  let filteredData = mockDeals.filter((deal) =>
    deal.name.toLowerCase().includes(dealsSearch.toLowerCase())
  );

  if (dealsStageFilter) {
    filteredData = filteredData.filter((deal) => deal.stage === dealsStageFilter);
  }

  const handleSort = (key: string) => {
    const newDirection =
      dealsSort?.field === key && dealsSort?.direction === 'asc' ? 'desc' : 'asc';
    setDealsSort(key, newDirection);
  };

  const handleRowClick = (row: typeof mockDeals[0]) => {
    router.push(`/deals/${row.id}`);
  };

  const handleCreateDeal = async (data: Record<string, any>) => {
    console.log('Creating deal:', data);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
        <p className="text-muted-foreground">
          Track your sales opportunities and pipeline.
        </p>
      </div>

      <EntityTable
        columns={columns}
        data={filteredData}
        loading={false}
        page={dealsPage}
        pageSize={20}
        total={filteredData.length}
        onPageChange={setDealsPage}
        sortBy={dealsSort?.field || null}
        sortDirection={dealsSort?.direction || 'asc'}
        onSort={handleSort}
        onRowClick={handleRowClick}
        searchValue={dealsSearch}
        onSearchChange={setDealsSearch}
        searchPlaceholder="Search deals..."
        filters={[
          {
            key: 'stage',
            label: 'Stage',
            value: dealsStageFilter,
            options: [
              { label: 'Lead', value: 'Lead' },
              { label: 'Qualification', value: 'Qualification' },
              { label: 'Proposal', value: 'Proposal' },
              { label: 'Negotiation', value: 'Negotiation' },
              { label: 'Closed Won', value: 'Closed Won' },
              { label: 'Closed Lost', value: 'Closed Lost' },
            ],
            onChange: setDealsStageFilter,
          },
        ]}
        onCreateNew={() => setCreateDialogOpen(true)}
        createLabel="New Deal"
        emptyMessage="No deals found. Create your first deal to get started."
      />

      <EntityFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Deal"
        description="Add a new deal to your pipeline."
        fields={formFields}
        onSubmit={handleCreateDeal}
        submitLabel="Create"
      />
    </div>
  );
}
