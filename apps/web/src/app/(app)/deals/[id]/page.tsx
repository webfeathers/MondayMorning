'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityDetail, FieldDefinition } from '@/components/entity-detail';
import { EntityFormDialog, FormFieldDefinition } from '@/components/entity-form-dialog';
import { Badge } from '@/components/ui/badge';

// Mock data
const mockDealData: Record<string, any> = {
  '1': {
    id: '1',
    name: 'Enterprise Software License',
    organization: 'Acme Corporation',
    stage: 'Negotiation',
    amount: 250000,
    probability: 75,
    closeDate: '2024-03-30',
    owner: 'John Doe',
    description: 'Multi-year enterprise software license agreement including support and training.',
    contactPerson: 'Sarah Johnson',
    contactEmail: 'sarah@acme.com',
    contactPhone: '+1 (555) 123-4567',
    nextStep: 'Schedule executive review meeting',
    competitors: 'CompanyX, CompanyY',
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-25T15:30:00Z',
  },
  '2': {
    id: '2',
    name: 'Manufacturing Equipment',
    organization: 'Global Industries',
    stage: 'Proposal',
    amount: 500000,
    probability: 50,
    closeDate: '2024-04-15',
    owner: 'Jane Smith',
    description: 'Custom manufacturing equipment with installation and 2-year warranty.',
    contactPerson: 'Michael Chen',
    contactEmail: 'michael@globalind.com',
    contactPhone: '+1 (555) 987-6543',
    nextStep: 'Send detailed proposal and pricing',
    competitors: 'Industrial Co, Tech Mfg',
    createdAt: '2024-02-10T14:30:00Z',
    updatedAt: '2024-02-22T11:15:00Z',
  },
};

const stageColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Lead: 'outline',
  Qualification: 'secondary',
  Proposal: 'default',
  Negotiation: 'default',
  'Closed Won': 'secondary',
  'Closed Lost': 'destructive',
};

const fieldDefinitions: FieldDefinition[] = [
  // Deal Information
  { key: 'name', label: 'Deal Name', section: 'Deal Information' },
  { key: 'organization', label: 'Organization', section: 'Deal Information' },
  {
    key: 'stage',
    label: 'Stage',
    section: 'Deal Information',
    render: (value) => <Badge variant={stageColors[value] || 'default'}>{value}</Badge>,
  },
  {
    key: 'amount',
    label: 'Amount',
    section: 'Deal Information',
    render: (value) => `$${value.toLocaleString()}`,
  },
  {
    key: 'probability',
    label: 'Probability',
    section: 'Deal Information',
    render: (value) => `${value}%`,
  },
  { key: 'closeDate', label: 'Expected Close Date', type: 'date', section: 'Deal Information' },
  { key: 'owner', label: 'Deal Owner', section: 'Deal Information' },

  // Contact Information
  { key: 'contactPerson', label: 'Contact Person', section: 'Contact Information' },
  { key: 'contactEmail', label: 'Email', type: 'email', section: 'Contact Information' },
  { key: 'contactPhone', label: 'Phone', section: 'Contact Information' },

  // Deal Details
  { key: 'description', label: 'Description', section: 'Deal Details' },
  { key: 'nextStep', label: 'Next Step', section: 'Deal Details' },
  { key: 'competitors', label: 'Competitors', section: 'Deal Details' },

  // Metadata
  { key: 'createdAt', label: 'Created', type: 'datetime', section: 'Metadata' },
  { key: 'updatedAt', label: 'Last Updated', type: 'datetime', section: 'Metadata' },
];

const formFields: FormFieldDefinition[] = [
  { key: 'name', label: 'Deal Name', type: 'text', required: true },
  { key: 'organization', label: 'Organization', type: 'text', required: true },
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
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'probability', label: 'Probability (%)', type: 'number' },
  { key: 'closeDate', label: 'Expected Close Date', type: 'date', required: true },
  { key: 'owner', label: 'Deal Owner', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'nextStep', label: 'Next Step', type: 'text' },
];

interface DealDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function DealDetailPage({ params }: DealDetailPageProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [id, setId] = useState<string | null>(null);

  params.then((p) => setId(p.id));

  if (!id) return null;

  const deal = mockDealData[id];

  const handleBack = () => router.push('/deals');
  const handleEdit = () => setEditDialogOpen(true);
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    console.log('Deleting deal:', id);
    router.push('/deals');
  };

  const handleUpdateDeal = async (data: Record<string, any>) => {
    console.log('Updating deal:', id, data);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <>
      <EntityDetail
        data={deal}
        loading={false}
        fields={fieldDefinitions}
        title={deal?.name}
        subtitle={`${deal?.organization} • $${deal?.amount?.toLocaleString()}`}
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="Deal not found"
      />

      <EntityFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Edit Deal"
        description="Update deal information."
        fields={formFields}
        initialData={deal}
        onSubmit={handleUpdateDeal}
        submitLabel="Save Changes"
      />
    </>
  );
}
