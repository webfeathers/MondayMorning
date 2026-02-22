import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TenantProvider } from '../providers/tenant-provider';
import { useTenant } from '../hooks/useTenant';

// Test component that uses the hook
function TenantConsumer() {
  const tenant = useTenant();
  return (
    <div>
      <div data-testid="tenant-id">{tenant.id}</div>
      <div data-testid="tenant-slug">{tenant.slug}</div>
      <div data-testid="tenant-name">{tenant.name}</div>
    </div>
  );
}

describe('TenantProvider', () => {
  it('wraps children and provides tenant context', () => {
    const mockTenant = {
      id: 'test-id-123',
      slug: 'acme',
      name: 'Acme Corp',
    };

    render(
      <TenantProvider tenant={mockTenant}>
        <TenantConsumer />
      </TenantProvider>
    );

    expect(screen.getByTestId('tenant-id')).toHaveTextContent('test-id-123');
    expect(screen.getByTestId('tenant-slug')).toHaveTextContent('acme');
    expect(screen.getByTestId('tenant-name')).toHaveTextContent('Acme Corp');
  });

  it('useTenant() returns tenant data', () => {
    const mockTenant = {
      id: 'tenant-456',
      slug: 'wondercorp',
      name: 'Wonder Corporation',
    };

    render(
      <TenantProvider tenant={mockTenant}>
        <TenantConsumer />
      </TenantProvider>
    );

    expect(screen.getByTestId('tenant-id')).toHaveTextContent('tenant-456');
    expect(screen.getByTestId('tenant-slug')).toHaveTextContent('wondercorp');
    expect(screen.getByTestId('tenant-name')).toHaveTextContent('Wonder Corporation');
  });

  it('useTenant() throws error if used outside provider', () => {
    // We need to catch the error from rendering
    const consoleError = console.error;
    console.error = () => {}; // Suppress React error boundary logs

    expect(() => {
      render(<TenantConsumer />);
    }).toThrow('useTenant must be used within a TenantProvider');

    console.error = consoleError;
  });
});
