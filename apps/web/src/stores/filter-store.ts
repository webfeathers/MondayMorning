import { create } from 'zustand';

interface FilterState {
  // Organizations filters
  organizationsSearch: string;
  organizationsPage: number;
  organizationsSort: { field: string; direction: 'asc' | 'desc' } | null;
  setOrganizationsSearch: (search: string) => void;
  setOrganizationsPage: (page: number) => void;
  setOrganizationsSort: (field: string, direction: 'asc' | 'desc') => void;
  resetOrganizationsFilters: () => void;

  // Deals filters
  dealsSearch: string;
  dealsPage: number;
  dealsSort: { field: string; direction: 'asc' | 'desc' } | null;
  dealsStageFilter: string | null;
  setDealsSearch: (search: string) => void;
  setDealsPage: (page: number) => void;
  setDealsSort: (field: string, direction: 'asc' | 'desc') => void;
  setDealsStageFilter: (stage: string | null) => void;
  resetDealsFilters: () => void;

  // Tickets filters
  ticketsSearch: string;
  ticketsPage: number;
  ticketsSort: { field: string; direction: 'asc' | 'desc' } | null;
  ticketsStatusFilter: string | null;
  setTicketsSearch: (search: string) => void;
  setTicketsPage: (page: number) => void;
  setTicketsSort: (field: string, direction: 'asc' | 'desc') => void;
  setTicketsStatusFilter: (status: string | null) => void;
  resetTicketsFilters: () => void;

  // Contacts filters
  contactsSearch: string;
  contactsPage: number;
  contactsSort: { field: string; direction: 'asc' | 'desc' } | null;
  setContactsSearch: (search: string) => void;
  setContactsPage: (page: number) => void;
  setContactsSort: (field: string, direction: 'asc' | 'desc') => void;
  resetContactsFilters: () => void;
}

const defaultSort = { field: 'createdAt', direction: 'desc' as const };

export const useFilterStore = create<FilterState>()((set) => ({
  // Organizations
  organizationsSearch: '',
  organizationsPage: 1,
  organizationsSort: defaultSort,
  setOrganizationsSearch: (search) => set({ organizationsSearch: search, organizationsPage: 1 }),
  setOrganizationsPage: (page) => set({ organizationsPage: page }),
  setOrganizationsSort: (field, direction) =>
    set({ organizationsSort: { field, direction } }),
  resetOrganizationsFilters: () =>
    set({
      organizationsSearch: '',
      organizationsPage: 1,
      organizationsSort: defaultSort,
    }),

  // Deals
  dealsSearch: '',
  dealsPage: 1,
  dealsSort: defaultSort,
  dealsStageFilter: null,
  setDealsSearch: (search) => set({ dealsSearch: search, dealsPage: 1 }),
  setDealsPage: (page) => set({ dealsPage: page }),
  setDealsSort: (field, direction) => set({ dealsSort: { field, direction } }),
  setDealsStageFilter: (stage) => set({ dealsStageFilter: stage, dealsPage: 1 }),
  resetDealsFilters: () =>
    set({
      dealsSearch: '',
      dealsPage: 1,
      dealsSort: defaultSort,
      dealsStageFilter: null,
    }),

  // Tickets
  ticketsSearch: '',
  ticketsPage: 1,
  ticketsSort: defaultSort,
  ticketsStatusFilter: null,
  setTicketsSearch: (search) => set({ ticketsSearch: search, ticketsPage: 1 }),
  setTicketsPage: (page) => set({ ticketsPage: page }),
  setTicketsSort: (field, direction) => set({ ticketsSort: { field, direction } }),
  setTicketsStatusFilter: (status) => set({ ticketsStatusFilter: status, ticketsPage: 1 }),
  resetTicketsFilters: () =>
    set({
      ticketsSearch: '',
      ticketsPage: 1,
      ticketsSort: defaultSort,
      ticketsStatusFilter: null,
    }),

  // Contacts
  contactsSearch: '',
  contactsPage: 1,
  contactsSort: defaultSort,
  setContactsSearch: (search) => set({ contactsSearch: search, contactsPage: 1 }),
  setContactsPage: (page) => set({ contactsPage: page }),
  setContactsSort: (field, direction) => set({ contactsSort: { field, direction } }),
  resetContactsFilters: () =>
    set({
      contactsSearch: '',
      contactsPage: 1,
      contactsSort: defaultSort,
    }),
}));
