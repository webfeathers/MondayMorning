'use client';

import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CheckCircle2, XCircle } from 'lucide-react';

interface CustomFieldRendererProps {
  value: any;
  type?: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'multiselect' | 'url' | 'email';
}

/**
 * CustomFieldRenderer
 * Renders custom field values based on their type
 * Handles formatting for dates, booleans, arrays, etc.
 */
export function CustomFieldRenderer({ value, type = 'text' }: CustomFieldRendererProps) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">—</span>;
  }

  // Boolean
  if (type === 'boolean') {
    return value ? (
      <div className="flex items-center gap-1 text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span>Yes</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-muted-foreground">
        <XCircle className="h-4 w-4" />
        <span>No</span>
      </div>
    );
  }

  // Date
  if (type === 'date') {
    try {
      const date = new Date(value);
      return <span>{format(date, 'MMM d, yyyy')}</span>;
    } catch {
      return <span>{String(value)}</span>;
    }
  }

  // DateTime
  if (type === 'datetime') {
    try {
      const date = new Date(value);
      return <span>{format(date, 'MMM d, yyyy h:mm a')}</span>;
    } catch {
      return <span>{String(value)}</span>;
    }
  }

  // Number
  if (type === 'number') {
    const num = Number(value);
    if (isNaN(num)) return <span>{String(value)}</span>;
    return <span>{num.toLocaleString()}</span>;
  }

  // URL
  if (type === 'url') {
    return (
      <a
        href={String(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {String(value)}
      </a>
    );
  }

  // Email
  if (type === 'email') {
    return (
      <a
        href={`mailto:${value}`}
        className="text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {String(value)}
      </a>
    );
  }

  // Select (single value)
  if (type === 'select') {
    return (
      <Badge variant="secondary" className="font-normal">
        {String(value)}
      </Badge>
    );
  }

  // Multiselect (array of values)
  if (type === 'multiselect') {
    if (!Array.isArray(value)) {
      return <Badge variant="secondary">{String(value)}</Badge>;
    }
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">None</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, index) => (
          <Badge key={index} variant="secondary" className="font-normal">
            {String(item)}
          </Badge>
        ))}
      </div>
    );
  }

  // Default: text
  return <span className="line-clamp-2">{String(value)}</span>;
}
