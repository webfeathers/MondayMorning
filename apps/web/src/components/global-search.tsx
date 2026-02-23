'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Building2, Handshake, Ticket, Users, Search } from 'lucide-react';

// Mock search data - will be replaced with API calls
const mockSearchData = {
  organizations: [
    { id: '1', name: 'Acme Corporation', industry: 'Technology' },
    { id: '2', name: 'Global Industries', industry: 'Manufacturing' },
    { id: '3', name: 'StartUp Inc', industry: 'Technology' },
  ],
  deals: [
    { id: '1', name: 'Enterprise Software License', organization: 'Acme Corporation', amount: 250000 },
    { id: '2', name: 'Manufacturing Equipment', organization: 'Global Industries', amount: 500000 },
    { id: '3', name: 'Consulting Services', organization: 'StartUp Inc', amount: 50000 },
  ],
  tickets: [
    { id: '1', title: 'Login Issues on Mobile App', organization: 'Acme Corporation', status: 'open' },
    { id: '2', title: 'Feature Request: Dark Mode', organization: 'Global Industries', status: 'in_progress' },
    { id: '3', title: 'Data Export Not Working', organization: 'StartUp Inc', status: 'resolved' },
  ],
  contacts: [
    { id: '1', name: 'Sarah Johnson', organization: 'Acme Corporation', title: 'VP of Engineering' },
    { id: '2', name: 'Michael Chen', organization: 'Global Industries', title: 'Operations Manager' },
    { id: '3', name: 'Lisa Wong', organization: 'StartUp Inc', title: 'CEO' },
  ],
};

interface SearchResult {
  id: string;
  type: 'organization' | 'deal' | 'ticket' | 'contact';
  title: string;
  subtitle: string;
  icon: typeof Building2;
  href: string;
}

/**
 * GlobalSearch Component
 * Command palette style search (Cmd+K / Ctrl+K) across all entities
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  // Keyboard shortcut to open search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search logic
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const searchQuery = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search organizations
    mockSearchData.organizations
      .filter(
        (org) =>
          org.name.toLowerCase().includes(searchQuery) ||
          org.industry.toLowerCase().includes(searchQuery)
      )
      .forEach((org) => {
        searchResults.push({
          id: org.id,
          type: 'organization',
          title: org.name,
          subtitle: org.industry,
          icon: Building2,
          href: `/organizations/${org.id}`,
        });
      });

    // Search deals
    mockSearchData.deals
      .filter(
        (deal) =>
          deal.name.toLowerCase().includes(searchQuery) ||
          deal.organization.toLowerCase().includes(searchQuery)
      )
      .forEach((deal) => {
        searchResults.push({
          id: deal.id,
          type: 'deal',
          title: deal.name,
          subtitle: `${deal.organization} • $${(deal.amount / 1000).toFixed(0)}K`,
          icon: Handshake,
          href: `/deals/${deal.id}`,
        });
      });

    // Search tickets
    mockSearchData.tickets
      .filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(searchQuery) ||
          ticket.organization.toLowerCase().includes(searchQuery)
      )
      .forEach((ticket) => {
        searchResults.push({
          id: ticket.id,
          type: 'ticket',
          title: ticket.title,
          subtitle: `${ticket.organization} • ${ticket.status}`,
          icon: Ticket,
          href: `/tickets/${ticket.id}`,
        });
      });

    // Search contacts
    mockSearchData.contacts
      .filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchQuery) ||
          contact.organization.toLowerCase().includes(searchQuery) ||
          contact.title.toLowerCase().includes(searchQuery)
      )
      .forEach((contact) => {
        searchResults.push({
          id: contact.id,
          type: 'contact',
          title: contact.name,
          subtitle: `${contact.title} at ${contact.organization}`,
          icon: Users,
          href: `/contacts/${contact.id}`,
        });
      });

    setResults(searchResults);
  }, [query]);

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  // Group results by type
  const organizationResults = results.filter((r) => r.type === 'organization');
  const dealResults = results.filter((r) => r.type === 'deal');
  const ticketResults = results.filter((r) => r.type === 'ticket');
  const contactResults = results.filter((r) => r.type === 'contact');

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search organizations, deals, tickets, contacts..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {organizationResults.length > 0 && (
          <>
            <CommandGroup heading="Organizations">
              {organizationResults.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  onSelect={() => handleSelect(result.href)}
                  className="flex items-center gap-2"
                >
                  <result.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{result.title}</p>
                    <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {dealResults.length > 0 && (
          <>
            <CommandGroup heading="Deals">
              {dealResults.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  onSelect={() => handleSelect(result.href)}
                  className="flex items-center gap-2"
                >
                  <result.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{result.title}</p>
                    <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {ticketResults.length > 0 && (
          <>
            <CommandGroup heading="Tickets">
              {ticketResults.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  onSelect={() => handleSelect(result.href)}
                  className="flex items-center gap-2"
                >
                  <result.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{result.title}</p>
                    <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {contactResults.length > 0 && (
          <CommandGroup heading="Contacts">
            {contactResults.map((result) => (
              <CommandItem
                key={`${result.type}-${result.id}`}
                onSelect={() => handleSelect(result.href)}
                className="flex items-center gap-2"
              >
                <result.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{result.title}</p>
                  <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * SearchTrigger Component
 * Button to open the global search
 */
export function SearchTrigger() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = () => {
    // Trigger the keyboard shortcut
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      <Search className="h-4 w-4" />
      <span>Search...</span>
      {mounted && (
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      )}
    </button>
  );
}
