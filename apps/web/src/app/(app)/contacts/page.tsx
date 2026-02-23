'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityTable } from '@/components/entity-table';
import { EntityFormDialog, FormFieldDefinition } from '@/components/entity-form-dialog';
import { CustomFieldRenderer } from '@/components/custom-field-renderer';
import { Column } from '@/components/data-table';
import { useFilterStore } from '@/stores';
import { User } from 'lucide-react';

// Mock data for demonstration
const mockContacts = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah@acme.com',
    phone: '+1 (555) 123-4567',
    organization: 'Acme Corporation',
    title: 'VP of Engineering',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Michael Chen',
    email: 'michael@globalind.com',
    phone: '+1 (555) 987-6543',
    organization: 'Global Industries',
    title: 'Operations Manager',
    isActive: true,
    createdAt: '2024-01-20T14:30:00Z',
  },
  {
    id: '3',
    name: 'Lisa Wong',
    email: 'lisa@startup.io',
    phone: '+1 (555) 456-7890',
    organization: 'StartUp Inc',
    title: 'CEO',
    isActive: true,
    createdAt: '2024-02-01T09:15:00Z',
  },
  {
    id: '4',
    name: 'Tom Brown',
    email: 'tom@acme.com',
    phone: '+1 (555) 234-5678',
    organization: 'Acme Corporation',
    title: 'Product Manager',
    isActive: false,
    createdAt: '2024-02-10T16:20:00Z',
  },
];

const columns: Column<typeof mockContacts[0]>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    render: (row) => (
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.name}</span>
      </div>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    sortable: true,
    render: (row) => <CustomFieldRenderer value={row.email} type="email" />,
  },
  {
    key: 'phone',
    header: 'Phone',
    sortable: true,
  },
  {
    key: 'organization',
    header: 'Organization',
    sortable: true,
  },
  {
    key: 'title',
    header: 'Title',
    sortable: true,
  },
  {
    key: 'isActive',
    header: 'Active',
    sortable: true,
    render: (row) => <CustomFieldRenderer value={row.isActive} type="boolean" />,
  },
];

const formFields: FormFieldDefinition[] = [
  {
    key: 'name',
    label: 'Full Name',
    type: 'text',
    required: true,
    placeholder: 'John Doe',
  },
  {
    key: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    placeholder: 'john@example.com',
  },
  {
    key: 'phone',
    label: 'Phone',
    type: 'text',
    placeholder: '+1 (555) 123-4567',
  },
  {
    key: 'organization',
    label: 'Organization',
    type: 'text',
    required: true,
  },
  {
    key: 'title',
    label: 'Job Title',
    type: 'text',
    placeholder: 'VP of Marketing',
  },
  {
    key: 'isActive',
    label: 'Active',
    type: 'boolean',
  },
];

/**
 * Contacts List Page
 * Shows all contacts with filtering, search, and CRUD operations
 */
export default function ContactsPage() {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const {
    contactsSearch,
    contactsPage,
    contactsSort,
    setContactsSearch,
    setContactsPage,
    setContactsSort,
  } = useFilterStore();

  // Filter data
  const filteredData = mockContacts.filter((contact) =>
    contact.name.toLowerCase().includes(contactsSearch.toLowerCase()) ||
    contact.email.toLowerCase().includes(contactsSearch.toLowerCase())
  );

  const handleSort = (key: string) => {
    const newDirection =
      contactsSort?.field === key && contactsSort?.direction === 'asc' ? 'desc' : 'asc';
    setContactsSort(key, newDirection);
  };

  const handleRowClick = (row: typeof mockContacts[0]) => {
    router.push(`/contacts/${row.id}`);
  };

  const handleCreateContact = async (data: Record<string, any>) => {
    console.log('Creating contact:', data);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground">
          Manage your contacts and relationships.
        </p>
      </div>

      <EntityTable
        columns={columns}
        data={filteredData}
        loading={false}
        page={contactsPage}
        pageSize={20}
        total={filteredData.length}
        onPageChange={setContactsPage}
        sortBy={contactsSort?.field || null}
        sortDirection={contactsSort?.direction || 'asc'}
        onSort={handleSort}
        onRowClick={handleRowClick}
        searchValue={contactsSearch}
        onSearchChange={setContactsSearch}
        searchPlaceholder="Search contacts..."
        onCreateNew={() => setCreateDialogOpen(true)}
        createLabel="New Contact"
        emptyMessage="No contacts found. Create your first contact to get started."
      />

      <EntityFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Contact"
        description="Add a new contact to your CRM."
        fields={formFields}
        onSubmit={handleCreateContact}
        submitLabel="Create"
      />
    </div>
  );
}
