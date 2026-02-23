'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Plus } from 'lucide-react';

interface FilterOption {
  label: string;
  value: string;
}

interface DataTableToolbarProps {
  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // Filters
  filters?: Array<{
    key: string;
    label: string;
    value: string | null;
    options: FilterOption[];
    onChange: (value: string | null) => void;
  }>;

  // Actions
  onCreateNew?: () => void;
  createLabel?: string;

  // Custom actions
  actions?: React.ReactNode;
}

export function DataTableToolbar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onCreateNew,
  createLabel = 'Create New',
  actions,
}: DataTableToolbarProps) {
  const hasActiveFilters = filters.some((f) => f.value !== null);

  const clearFilters = () => {
    filters.forEach((f) => f.onChange(null));
    if (onSearchChange) {
      onSearchChange('');
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left side - Search and filters */}
      <div className="flex flex-1 items-center gap-2">
        {/* Search */}
        {onSearchChange && (
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Filter dropdowns */}
        {filters.map((filter) => (
          <Select
            key={filter.key}
            value={filter.value || undefined}
            onValueChange={(value) => filter.onChange(value === '__all__' ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All {filter.label}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {actions}
        {onCreateNew && (
          <Button onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            {createLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
