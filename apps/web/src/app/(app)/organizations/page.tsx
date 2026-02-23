'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityTable } from '@/components/entity-table';
import { EntityFormDialog, FormFieldDefinition } from '@/components/entity-form-dialog';
import { CustomFieldRenderer } from '@/components/custom-field-renderer';
import { Column } from '@/components/data-table';
import { useFilterStore } from '@/stores';
import { Building2 } from 'lucide-react';

// Mock data for demonstration until API is ready
const mockOrganizations = [
  {
    id: '1',
    name: 'Acme Corporation',
    industry: 'Technology',
    size: 'Enterprise',
    website: 'https://acme.com',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-02-20T14:30:00Z',
  },
  {
    id: '2',
    name: 'Global Industries',
    industry: 'Manufacturing',
    size: 'Mid-Market',
    website: 'https://globalind.com',
    createdAt: '2024-01-20T09:15:00Z',
    updatedAt: '2024-02-18T11:45:00Z',
  },
  {
    id: '3',
    name: 'StartUp Inc',
    industry: 'Technology',
    size: 'Small',
    website: 'https://startup.io',
    createdAt: '2024-02-01T13:20:00Z',
    updatedAt: '2024-02-22T16:00:00Z',
  },
];

const columns: Column<typeof mockOrganizations[0]>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.name}</span>
      </div>
    ),
  },
  {
    key: 'industry',
    header: 'Industry',
    sortable: true,
  },
  {
    key: 'size',
    header: 'Size',
    sortable: true,
  },
  {
    key: 'website',
    header: 'Website',
    render: (row) => <CustomFieldRenderer value={row.website} type="url" />,
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
    key: 'name',
    label: 'Organization Name',
    type: 'text',
    required: true,
    placeholder: 'Acme Corporation',
  },
  {
    key: 'industry',
    label: 'Industry',
    type: 'select',
    required: true,
    options: [
      { label: 'Technology', value: 'Technology' },
      { label: 'Manufacturing', value: 'Manufacturing' },
      { label: 'Healthcare', value: 'Healthcare' },
      { label: 'Finance', value: 'Finance' },
      { label: 'Retail', value: 'Retail' },
      { label: 'Other', value: 'Other' },
    ],
  },
  {
    key: 'size',
    label: 'Company Size',
    type: 'select',
    required: true,
    options: [
      { label: 'Small (1-50)', value: 'Small' },
      { label: 'Mid-Market (51-500)', value: 'Mid-Market' },
      { label: 'Enterprise (500+)', value: 'Enterprise' },
    ],
  },
  {
    key: 'website',
    label: 'Website',
    type: 'url',
    placeholder: 'https://example.com',
  },
];

/**
 * Organizations List Page
 * Shows all organizations with filtering, search, and CRUD operations
 */
export default function OrganizationsPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Get filter state from store
  const {
    organizationsSearch,
    organizationsPage,
    organizationsSort,
    setOrganizationsSearch,
    setOrganizationsPage,
    setOrganizationsSort,
  } = useFilterStore();

  // Filter and sort data (will be replaced with API call)
  const filteredData = mockOrganizations.filter((org) =>
    org.name.toLowerCase().includes(organizationsSearch.toLowerCase())
  );

  const handleSort = (key: string) => {
    const newDirection =
      organizationsSort?.field === key && organizationsSort?.direction === 'asc'
        ? 'desc'
        : 'asc';
    setOrganizationsSort(key, newDirection);
  };

  const handleRowClick = (row: typeof mockOrganizations[0]) => {
    router.push(`/organizations/${row.id}`);
  };

  const handleCreateOrganization = async (data: Record<string, any>) => {
    // TODO: Replace with actual API call using useCreateOrganization hook
    console.log('Creating organization:', data);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground">
          Manage your customer accounts and organizations.
        </p>
      </div>

      <EntityTable
        columns={columns}
        data={filteredData}
        loading={false}
        page={organizationsPage}
        pageSize={20}
        total={filteredData.length}
        onPageChange={setOrganizationsPage}
        sortBy={organizationsSort?.field || null}
        sortDirection={organizationsSort?.direction || 'asc'}
        onSort={handleSort}
        onRowClick={handleRowClick}
        searchValue={organizationsSearch}
        onSearchChange={setOrganizationsSearch}
        searchPlaceholder="Search organizations..."
        onCreateNew={() => setCreateDialogOpen(true)}
        createLabel="New Organization"
        emptyMessage="No organizations found. Create your first organization to get started."
      />

      <EntityFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Organization"
        description="Add a new organization to your CRM."
        fields={formFields}
        onSubmit={handleCreateOrganization}
        submitLabel="Create"
      />
    </div>
  );
}
