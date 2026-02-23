'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityDetail, FieldDefinition } from '@/components/entity-detail';
import { EntityFormDialog, FormFieldDefinition } from '@/components/entity-form-dialog';

// Mock data for demonstration until API is ready
const mockOrganizationData: Record<string, any> = {
  '1': {
    id: '1',
    name: 'Acme Corporation',
    industry: 'Technology',
    size: 'Enterprise',
    website: 'https://acme.com',
    email: 'contact@acme.com',
    phone: '+1 (555) 123-4567',
    address: '123 Tech Street, San Francisco, CA 94105',
    description: 'Leading provider of innovative technology solutions for enterprises.',
    employees: 5000,
    revenue: 500000000,
    founded: '1995-03-15',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-02-20T14:30:00Z',
  },
  '2': {
    id: '2',
    name: 'Global Industries',
    industry: 'Manufacturing',
    size: 'Mid-Market',
    website: 'https://globalind.com',
    email: 'info@globalind.com',
    phone: '+1 (555) 987-6543',
    address: '456 Industrial Blvd, Detroit, MI 48201',
    description: 'International manufacturing company with operations worldwide.',
    employees: 1200,
    revenue: 150000000,
    founded: '1980-07-22',
    isActive: true,
    createdAt: '2024-01-20T09:15:00Z',
    updatedAt: '2024-02-18T11:45:00Z',
  },
  '3': {
    id: '3',
    name: 'StartUp Inc',
    industry: 'Technology',
    size: 'Small',
    website: 'https://startup.io',
    email: 'hello@startup.io',
    phone: '+1 (555) 456-7890',
    address: '789 Innovation Way, Austin, TX 78701',
    description: 'Fast-growing startup disrupting the tech industry.',
    employees: 45,
    revenue: 5000000,
    founded: '2022-11-10',
    isActive: true,
    createdAt: '2024-02-01T13:20:00Z',
    updatedAt: '2024-02-22T16:00:00Z',
  },
};

const fieldDefinitions: FieldDefinition[] = [
  // Basic Information
  { key: 'name', label: 'Organization Name', section: 'Basic Information' },
  { key: 'industry', label: 'Industry', section: 'Basic Information' },
  { key: 'size', label: 'Company Size', section: 'Basic Information' },
  { key: 'employees', label: 'Employees', type: 'number', section: 'Basic Information' },
  { key: 'founded', label: 'Founded', type: 'date', section: 'Basic Information' },
  { key: 'isActive', label: 'Active', type: 'boolean', section: 'Basic Information' },

  // Contact Information
  { key: 'website', label: 'Website', type: 'url', section: 'Contact Information' },
  { key: 'email', label: 'Email', type: 'email', section: 'Contact Information' },
  { key: 'phone', label: 'Phone', section: 'Contact Information' },
  { key: 'address', label: 'Address', section: 'Contact Information' },

  // Business Details
  {
    key: 'revenue',
    label: 'Annual Revenue',
    section: 'Business Details',
    render: (value) => `$${(value / 1000000).toFixed(1)}M`,
  },
  { key: 'description', label: 'Description', section: 'Business Details' },

  // Metadata
  { key: 'createdAt', label: 'Created', type: 'datetime', section: 'Metadata' },
  { key: 'updatedAt', label: 'Last Updated', type: 'datetime', section: 'Metadata' },
];

const formFields: FormFieldDefinition[] = [
  { key: 'name', label: 'Organization Name', type: 'text', required: true },
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
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'address', label: 'Address', type: 'textarea' },
  { key: 'employees', label: 'Employees', type: 'number' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

interface OrganizationDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Organization Detail Page
 * Displays full details of a single organization with edit/delete actions
 */
export default function OrganizationDetailPage({ params }: OrganizationDetailPageProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [id, setId] = useState<string | null>(null);

  // Unwrap params
  params.then((p) => setId(p.id));

  if (!id) {
    return null;
  }

  // Get organization data (will be replaced with useOrganization hook)
  const organization = mockOrganizationData[id];

  const handleBack = () => {
    router.push('/organizations');
  };

  const handleEdit = () => {
    setEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this organization?')) {
      return;
    }

    // TODO: Replace with actual API call using useDeleteOrganization hook
    console.log('Deleting organization:', id);
    router.push('/organizations');
  };

  const handleUpdateOrganization = async (data: Record<string, any>) => {
    // TODO: Replace with actual API call using useUpdateOrganization hook
    console.log('Updating organization:', id, data);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <>
      <EntityDetail
        data={organization}
        loading={false}
        fields={fieldDefinitions}
        title={organization?.name}
        subtitle={`${organization?.industry} • ${organization?.size}`}
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="Organization not found"
      />

      <EntityFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Edit Organization"
        description="Update organization information."
        fields={formFields}
        initialData={organization}
        onSubmit={handleUpdateOrganization}
        submitLabel="Save Changes"
      />
    </>
  );
}
