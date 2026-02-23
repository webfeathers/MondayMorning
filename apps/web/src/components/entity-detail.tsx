'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { CustomFieldRenderer } from './custom-field-renderer';
import { Edit, Trash2, ArrowLeft } from 'lucide-react';

export interface FieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'multiselect' | 'url' | 'email';
  section?: string;
  render?: (value: any) => React.ReactNode;
}

interface EntityDetailProps {
  // Data
  data: Record<string, any> | null;
  loading?: boolean;
  error?: Error | null;

  // Field definitions
  fields: FieldDefinition[];

  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;

  // Custom sections
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;

  // Customization
  emptyMessage?: string;
  errorMessage?: string;
}

/**
 * EntityDetail
 * Component for displaying record details in a structured layout
 * Supports core fields, custom fields, sections, and actions
 */
export function EntityDetail({
  data,
  loading = false,
  error = null,
  fields,
  onEdit,
  onDelete,
  onBack,
  title,
  subtitle,
  headerActions,
  emptyMessage = 'No data found',
  errorMessage,
}: EntityDetailProps) {
  // Group fields by section
  const fieldsBySection = fields.reduce((acc, field) => {
    const section = field.section || 'General';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {} as Record<string, FieldDefinition[]>);

  const sections = Object.keys(fieldsBySection);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>

        {/* Content skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-8 text-center">
          <p className="text-sm text-destructive">
            {errorMessage || error.message || 'An error occurred loading the record'}
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data) {
    return (
      <div className="space-y-4">
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        <div className="rounded-md border border-dashed border-muted-foreground/50 p-12 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          {title && <h1 className="text-3xl font-bold tracking-tight">{title}</h1>}
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          {headerActions}
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="grid gap-6">
        {sections.map((sectionName) => (
          <Card key={sectionName}>
            <CardHeader>
              <CardTitle>{sectionName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {fieldsBySection[sectionName].map((field) => {
                  const value = data[field.key];

                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">
                        {field.label}
                      </label>
                      <div className="text-sm">
                        {field.render ? (
                          field.render(value)
                        ) : (
                          <CustomFieldRenderer value={value} type={field.type} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
