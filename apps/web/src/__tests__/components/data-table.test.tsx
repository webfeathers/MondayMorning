import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable, Column } from '@/components/data-table';

interface TestRow {
  id: string;
  name: string;
  email: string;
  status: string;
}

const mockData: TestRow[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', status: 'active' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com', status: 'active' },
];

const mockColumns: Column<TestRow>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email', sortable: true },
  { key: 'status', header: 'Status', sortable: false },
];

describe('DataTable', () => {
  it('renders table with data', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        total={mockData.length}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
  });

  it('renders loading state', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={[]}
        loading={true}
      />
    );

    // Should render skeleton rows
    const skeletons = screen.getAllByRole('row');
    expect(skeletons.length).toBeGreaterThan(1); // Header + skeleton rows
  });

  it('renders empty state', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={[]}
        emptyMessage="No records found"
      />
    );

    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const error = new Error('Failed to load data');
    render(
      <DataTable
        columns={mockColumns}
        data={[]}
        error={error}
        errorMessage="Error loading records"
      />
    );

    expect(screen.getByText('Error loading records')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders custom cell content', () => {
    const customColumns: Column<TestRow>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (row) => <strong>{row.name.toUpperCase()}</strong>,
      },
    ];

    render(
      <DataTable
        columns={customColumns}
        data={mockData}
      />
    );

    expect(screen.getByText('JOHN DOE')).toBeInTheDocument();
  });

  it('displays pagination info', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={1}
        pageSize={2}
        total={10}
      />
    );

    expect(screen.getByText(/Showing 1 to 2 of 10 results/)).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 5/)).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onRowClick={onRowClick}
      />
    );

    const firstRow = screen.getByText('John Doe').closest('tr');
    firstRow?.click();

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('calls onPageChange when pagination buttons are clicked', () => {
    const onPageChange = vi.fn();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={2}
        pageSize={2}
        total={10}
        onPageChange={onPageChange}
      />
    );

    const nextButton = screen.getByText('Next').closest('button');
    nextButton?.click();

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onSort when sortable column header is clicked', () => {
    const onSort = vi.fn();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        onSort={onSort}
      />
    );

    const nameHeader = screen.getByText('Name').closest('th');
    nameHeader?.click();

    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('disables previous button on first page', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={1}
        pageSize={2}
        total={10}
      />
    );

    const previousButton = screen.getByText('Previous').closest('button');
    expect(previousButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        page={5}
        pageSize={2}
        total={10}
      />
    );

    const nextButton = screen.getByText('Next').closest('button');
    expect(nextButton).toBeDisabled();
  });
});
