import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSearch, SearchTrigger } from '@/components/global-search';

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('GlobalSearch', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders with dialog closed by default', () => {
    render(<GlobalSearch />);

    // Dialog should not be visible initially
    expect(
      screen.queryByPlaceholderText(/search organizations, deals, tickets, contacts/i)
    ).not.toBeInTheDocument();
  });

  it('shows empty state when no query entered', async () => {
    render(<GlobalSearch defaultOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it('searches organizations by name', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch defaultOpen={true} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i)
      ).toBeInTheDocument();
    });

    // Type search query
    const input = screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i);
    await user.type(input, 'Acme');

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      expect(screen.getByText('Organizations')).toBeInTheDocument();
    });
  });

  it('searches deals by name', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch defaultOpen={true} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i)
      ).toBeInTheDocument();
    });

    // Type search query
    const input = screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i);
    await user.type(input, 'Software');

    await waitFor(() => {
      expect(screen.getByText('Enterprise Software License')).toBeInTheDocument();
      expect(screen.getByText('Deals')).toBeInTheDocument();
    });
  });

  it('searches tickets by title', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch defaultOpen={true} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i)
      ).toBeInTheDocument();
    });

    // Type search query
    const input = screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i);
    await user.type(input, 'Login');

    await waitFor(() => {
      expect(screen.getByText('Login Issues on Mobile App')).toBeInTheDocument();
      expect(screen.getByText('Tickets')).toBeInTheDocument();
    });
  });

  it('searches contacts by name', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch defaultOpen={true} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i)
      ).toBeInTheDocument();
    });

    // Type search query
    const input = screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i);
    await user.type(input, 'Sarah');

    await waitFor(() => {
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Contacts')).toBeInTheDocument();
    });
  });

  it('navigates to result when clicked', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch defaultOpen={true} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i)
      ).toBeInTheDocument();
    });

    // Type search query
    const input = screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i);
    await user.type(input, 'Acme');

    await waitFor(() => {
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });

    // Click result
    const result = screen.getByText('Acme Corporation');
    await user.click(result);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/organizations/1');
    });
  });

  it('shows results from multiple entity types', async () => {
    const user = userEvent.setup();
    render(<GlobalSearch defaultOpen={true} />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i)
      ).toBeInTheDocument();
    });

    // Type broad search query that matches multiple types
    const input = screen.getByPlaceholderText(/search organizations, deals, tickets, contacts/i);
    await user.type(input, 'Acme');

    await waitFor(() => {
      // Should find organization, deal, ticket, and contact
      expect(screen.getByText('Organizations')).toBeInTheDocument();
      expect(screen.getByText('Deals')).toBeInTheDocument();
      expect(screen.getByText('Tickets')).toBeInTheDocument();
    });
  });
});

describe('SearchTrigger', () => {
  it('renders search button with keyboard hint', () => {
    render(<SearchTrigger />);

    expect(screen.getByText('Search...')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('dispatches keyboard event when clicked', async () => {
    const user = userEvent.setup();
    const dispatchEventSpy = vi.spyOn(document, 'dispatchEvent');

    render(<SearchTrigger />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'keydown',
        key: 'k',
        metaKey: true,
      })
    );

    dispatchEventSpy.mockRestore();
  });
});
