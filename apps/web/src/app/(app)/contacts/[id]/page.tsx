'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntityDetail, FieldDefinition } from '@/components/entity-detail';
import { EntityFormDialog, FormFieldDefinition } from '@/components/entity-form-dialog';

// Mock data
const mockContactData: Record<string, any> = {
  '1': {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah@acme.com',
    phone: '+1 (555) 123-4567',
    mobile: '+1 (555) 123-4568',
    organization: 'Acme Corporation',
    title: 'VP of Engineering',
    department: 'Engineering',
    linkedin: 'https://linkedin.com/in/sarahjohnson',
    address: '123 Tech Street, San Francisco, CA 94105',
    birthday: '1985-06-15',
    notes: 'Key decision maker for technical purchases. Prefers email communication.',
    isActive: true,
    source: 'Website Form',
    lastContactedAt: '2024-02-20T10:30:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-02-20T10:30:00Z',
  },
  '2': {
    id: '2',
    name: 'Michael Chen',
    email: 'michael@globalind.com',
    phone: '+1 (555) 987-6543',
    mobile: '+1 (555) 987-6544',
    organization: 'Global Industries',
    title: 'Operations Manager',
    department: 'Operations',
    linkedin: 'https://linkedin.com/in/michaelchen',
    address: '456 Industrial Blvd, Detroit, MI 48201',
    birthday: '1978-11-22',
    notes: 'Interested in automation solutions. Schedule calls between 2-4 PM EST.',
    isActive: true,
    source: 'Referral',
    lastContactedAt: '2024-02-18T14:15:00Z',
    createdAt: '2024-01-20T14:30:00Z',
    updatedAt: '2024-02-18T14:15:00Z',
  },
  '3': {
    id: '3',
    name: 'Lisa Wong',
    email: 'lisa@startup.io',
    phone: '+1 (555) 456-7890',
    mobile: '+1 (555) 456-7891',
    organization: 'StartUp Inc',
    title: 'CEO',
    department: 'Executive',
    linkedin: 'https://linkedin.com/in/lisawong',
    address: '789 Innovation Way, Austin, TX 78701',
    birthday: '1990-03-08',
    notes: 'Fast-growing startup, looking for scalable solutions. Very responsive to email.',
    isActive: true,
    source: 'Conference',
    lastContactedAt: '2024-02-22T09:00:00Z',
    createdAt: '2024-02-01T09:15:00Z',
    updatedAt: '2024-02-22T09:00:00Z',
  },
  '4': {
    id: '4',
    name: 'Tom Brown',
    email: 'tom@acme.com',
    phone: '+1 (555) 234-5678',
    mobile: '+1 (555) 234-5679',
    organization: 'Acme Corporation',
    title: 'Product Manager',
    department: 'Product',
    linkedin: 'https://linkedin.com/in/tombrown',
    address: '123 Tech Street, San Francisco, CA 94105',
    birthday: '1988-09-30',
    notes: 'Previously active contact, moved to different role internally.',
    isActive: false,
    source: 'LinkedIn',
    lastContactedAt: '2024-01-10T16:45:00Z',
    createdAt: '2024-02-10T16:20:00Z',
    updatedAt: '2024-02-15T11:30:00Z',
  },
};

const fieldDefinitions: FieldDefinition[] = [
  // Contact Information
  { key: 'name', label: 'Full Name', section: 'Contact Information' },
  { key: 'email', label: 'Email', type: 'email', section: 'Contact Information' },
  { key: 'phone', label: 'Phone', section: 'Contact Information' },
  { key: 'mobile', label: 'Mobile', section: 'Contact Information' },
  { key: 'linkedin', label: 'LinkedIn', type: 'url', section: 'Contact Information' },
  { key: 'address', label: 'Address', section: 'Contact Information' },
  { key: 'birthday', label: 'Birthday', type: 'date', section: 'Contact Information' },

  // Professional Details
  { key: 'organization', label: 'Organization', section: 'Professional Details' },
  { key: 'title', label: 'Title', section: 'Professional Details' },
  { key: 'department', label: 'Department', section: 'Professional Details' },
  { key: 'isActive', label: 'Active', type: 'boolean', section: 'Professional Details' },

  // Engagement
  { key: 'source', label: 'Source', section: 'Engagement' },
  { key: 'lastContactedAt', label: 'Last Contacted', type: 'datetime', section: 'Engagement' },
  { key: 'notes', label: 'Notes', section: 'Engagement' },

  // Metadata
  { key: 'createdAt', label: 'Created', type: 'datetime', section: 'Metadata' },
  { key: 'updatedAt', label: 'Last Updated', type: 'datetime', section: 'Metadata' },
];

const formFields: FormFieldDefinition[] = [
  { key: 'name', label: 'Full Name', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'mobile', label: 'Mobile', type: 'text' },
  { key: 'organization', label: 'Organization', type: 'text', required: true },
  { key: 'title', label: 'Job Title', type: 'text' },
  { key: 'department', label: 'Department', type: 'text' },
  { key: 'linkedin', label: 'LinkedIn URL', type: 'url' },
  { key: 'address', label: 'Address', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'isActive', label: 'Active', type: 'boolean' },
];

interface ContactDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ContactDetailPage({ params }: ContactDetailPageProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [id, setId] = useState<string | null>(null);

  params.then((p) => setId(p.id));

  if (!id) return null;

  const contact = mockContactData[id];

  const handleBack = () => router.push('/contacts');
  const handleEdit = () => setEditDialogOpen(true);
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    console.log('Deleting contact:', id);
    router.push('/contacts');
  };

  const handleUpdateContact = async (data: Record<string, any>) => {
    console.log('Updating contact:', id, data);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <>
      <EntityDetail
        data={contact}
        loading={false}
        fields={fieldDefinitions}
        title={contact?.name}
        subtitle={`${contact?.title} at ${contact?.organization}`}
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="Contact not found"
      />

      <EntityFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Edit Contact"
        description="Update contact information."
        fields={formFields}
        initialData={contact}
        onSubmit={handleUpdateContact}
        submitLabel="Save Changes"
      />
    </>
  );
}
