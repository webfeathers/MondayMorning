'use client';

import { DataTable, Column } from './data-table';
import { DataTableToolbar } from './data-table-toolbar';

interface EntityTableProps<T> {
  // Table props
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: Error | null;

  // Pagination
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;

  // Sorting
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;

  // Row actions
  onRowClick?: (row: T) => void;

  // Toolbar props
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  filters?: Array<{
    key: string;
    label: string;
    value: string | null;
    options: Array<{ label: string; value: string }>;
    onChange: (value: string | null) => void;
  }>;

  onCreateNew?: () => void;
  createLabel?: string;
  toolbarActions?: React.ReactNode;

  // Custom messages
  emptyMessage?: string;
  errorMessage?: string;
}

/**
 * EntityTable
 * Combines DataTable and DataTableToolbar for a complete table experience
 * Used across Organizations, Deals, Tickets, and Contacts pages
 */
export function EntityTable<T extends { id: string }>(props: EntityTableProps<T>) {
  const {
    columns,
    data,
    loading,
    error,
    page,
    pageSize,
    total,
    onPageChange,
    sortBy,
    sortDirection,
    onSort,
    onRowClick,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    filters,
    onCreateNew,
    createLabel,
    toolbarActions,
    emptyMessage,
    errorMessage,
  } = props;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <DataTableToolbar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        onCreateNew={onCreateNew}
        createLabel={createLabel}
        actions={toolbarActions}
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        error={error}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={onSort}
        onRowClick={onRowClick}
        emptyMessage={emptyMessage}
        errorMessage={errorMessage}
      />
    </div>
  );
}
