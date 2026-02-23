'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityDetail, FieldDefinition } from '@/components/entity-detail';
import { EntityFormDialog, FormFieldDefinition } from '@/components/entity-form-dialog';
import { Badge } from '@/components/ui/badge';

// Mock data
const mockTicketData: Record<string, any> = {
  '1': {
    id: '1',
    title: 'Login Issues on Mobile App',
    status: 'open',
    priority: 'high',
    organization: 'Acme Corporation',
    assignee: 'John Doe',
    reporter: 'Sarah Johnson',
    reporterEmail: 'sarah@acme.com',
    description: 'Users are experiencing intermittent login failures on the iOS mobile app. The issue seems to occur more frequently during peak hours.',
    steps: '1. Open mobile app\n2. Enter credentials\n3. Click login\n4. App crashes or shows "Authentication failed" error',
    expectedBehavior: 'Users should be able to login successfully',
    actualBehavior: 'Login fails with authentication error or app crash',
    environment: 'iOS 17.2, App version 2.3.1',
    attachments: 'error-log.txt, screenshot.png',
    createdAt: '2024-02-20T09:00:00Z',
    updatedAt: '2024-02-20T15:30:00Z',
  },
  '2': {
    id: '2',
    title: 'Feature Request: Dark Mode',
    status: 'in_progress',
    priority: 'medium',
    organization: 'Global Industries',
    assignee: 'Jane Smith',
    reporter: 'Michael Chen',
    reporterEmail: 'michael@globalind.com',
    description: 'Request to add a dark mode theme option to the application for better viewing in low-light environments.',
    steps: '',
    expectedBehavior: 'Application should have a toggle for dark mode',
    actualBehavior: 'No dark mode option available',
    environment: 'Web App, Chrome 120',
    attachments: 'mockup-dark-mode.png',
    createdAt: '2024-02-19T14:30:00Z',
    updatedAt: '2024-02-22T11:20:00Z',
  },
  '3': {
    id: '3',
    title: 'Data Export Not Working',
    status: 'resolved',
    priority: 'urgent',
    organization: 'StartUp Inc',
    assignee: 'Bob Johnson',
    reporter: 'Lisa Wong',
    reporterEmail: 'lisa@startup.io',
    description: 'CSV export functionality is failing for large datasets (>10,000 rows). Export button shows loading but never completes.',
    steps: '1. Navigate to Data section\n2. Click Export CSV button\n3. Select all data\n4. Click Export',
    expectedBehavior: 'CSV file should download successfully',
    actualBehavior: 'Export hangs indefinitely without producing file',
    environment: 'Web App, Firefox 121',
    attachments: 'network-log.har',
    createdAt: '2024-02-18T11:15:00Z',
    updatedAt: '2024-02-23T09:45:00Z',
  },
  '4': {
    id: '4',
    title: 'API Rate Limit Question',
    status: 'closed',
    priority: 'low',
    organization: 'Acme Corporation',
    assignee: 'John Doe',
    reporter: 'Tom Brown',
    reporterEmail: 'tom@acme.com',
    description: 'Customer inquiry about API rate limits for the Pro plan. They want to know if they can request an increase.',
    steps: '',
    expectedBehavior: '',
    actualBehavior: '',
    environment: '',
    attachments: '',
    createdAt: '2024-02-15T16:45:00Z',
    updatedAt: '2024-02-16T10:20:00Z',
  },
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

const fieldDefinitions: FieldDefinition[] = [
  // Ticket Information
  { key: 'title', label: 'Title', section: 'Ticket Information' },
  {
    key: 'status',
    label: 'Status',
    section: 'Ticket Information',
    render: (value) => (
      <Badge variant={statusColors[value] || 'default'}>
        {value.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    key: 'priority',
    label: 'Priority',
    section: 'Ticket Information',
    render: (value) => <Badge variant={priorityColors[value] || 'default'}>{value}</Badge>,
  },
  { key: 'organization', label: 'Organization', section: 'Ticket Information' },
  { key: 'assignee', label: 'Assignee', section: 'Ticket Information' },

  // Reporter Information
  { key: 'reporter', label: 'Reporter', section: 'Reporter Information' },
  { key: 'reporterEmail', label: 'Email', type: 'email', section: 'Reporter Information' },

  // Issue Details
  { key: 'description', label: 'Description', section: 'Issue Details' },
  { key: 'steps', label: 'Steps to Reproduce', section: 'Issue Details' },
  { key: 'expectedBehavior', label: 'Expected Behavior', section: 'Issue Details' },
  { key: 'actualBehavior', label: 'Actual Behavior', section: 'Issue Details' },
  { key: 'environment', label: 'Environment', section: 'Issue Details' },
  { key: 'attachments', label: 'Attachments', section: 'Issue Details' },

  // Metadata
  { key: 'createdAt', label: 'Created', type: 'datetime', section: 'Metadata' },
  { key: 'updatedAt', label: 'Last Updated', type: 'datetime', section: 'Metadata' },
];

const formFields: FormFieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'organization', label: 'Organization', type: 'text', required: true },
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
  { key: 'assignee', label: 'Assignee', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
];

interface TicketDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function TicketDetailPage({ params }: TicketDetailPageProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [id, setId] = useState<string | null>(null);

  params.then((p) => setId(p.id));

  if (!id) return null;

  const ticket = mockTicketData[id];

  const handleBack = () => router.push('/tickets');
  const handleEdit = () => setEditDialogOpen(true);
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this ticket?')) return;
    console.log('Deleting ticket:', id);
    router.push('/tickets');
  };

  const handleUpdateTicket = async (data: Record<string, any>) => {
    console.log('Updating ticket:', id, data);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <>
      <EntityDetail
        data={ticket}
        loading={false}
        fields={fieldDefinitions}
        title={ticket?.title}
        subtitle={`${ticket?.organization} • ${ticket?.status} • ${ticket?.priority}`}
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="Ticket not found"
      />

      <EntityFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Edit Ticket"
        description="Update ticket information."
        fields={formFields}
        initialData={ticket}
        onSubmit={handleUpdateTicket}
        submitLabel="Save Changes"
      />
    </>
  );
}
