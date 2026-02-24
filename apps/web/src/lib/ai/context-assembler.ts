/**
 * Context assembler for AI crew execution.
 *
 * Fetches normalized CRM data from the database and assembles it into
 * a format suitable for AI analysis, with token budget awareness and pruning.
 */

import { db } from '@wf/db';
import type { AssembledContext, ContextAssemblyOptions, ContextData } from './types';

/**
 * Estimate token count for a JSON object.
 * Rough estimation: ~4 characters per token
 */
function estimateTokens(data: unknown): number {
  const jsonString = JSON.stringify(data);
  return Math.ceil(jsonString.length / 4);
}

/**
 * Prune object by removing large text fields if needed.
 */
function pruneObject(obj: Record<string, unknown>, maxSize: number): {
  pruned: Record<string, unknown>;
  prunedFields: string[];
} {
  const pruned = { ...obj };
  const prunedFields: string[] = [];

  // Fields that can be safely pruned if we need to reduce size
  const prunableFields = ['description', 'notes', 'content', 'body', 'details'];

  let currentSize = JSON.stringify(pruned).length;

  for (const field of prunableFields) {
    if (currentSize <= maxSize) break;

    if (field in pruned && typeof pruned[field] === 'string') {
      const originalValue = pruned[field] as string;
      if (originalValue.length > 100) {
        // Truncate to first 100 characters
        pruned[field] = originalValue.substring(0, 100) + '...';
        prunedFields.push(field);
        currentSize = JSON.stringify(pruned).length;
      }
    }
  }

  return { pruned, prunedFields };
}

/**
 * Assemble context for account health analysis.
 */
export async function assembleAccountHealthContext(
  accountId: string,
  tenantId: string,
  options: ContextAssemblyOptions = {}
): Promise<AssembledContext> {
  const {
    maxTokens = 100000,
    includeActivities = true,
    activityDays = 90,
    maxRecordsPerType = 1000,
  } = options;

  // Fetch account data
  const accounts = await db.query.accounts.findMany({
    where: (accounts, { eq, and }) =>
      and(eq(accounts.id, accountId), eq(accounts.tenantId, tenantId)),
    limit: 1,
  });

  if (!accounts || accounts.length === 0) {
    throw new Error(`Account ${accountId} not found`);
  }

  // Fetch related contacts
  const contacts = await db.query.contacts.findMany({
    where: (contacts, { eq, and }) =>
      and(eq(contacts.accountId, accountId), eq(contacts.tenantId, tenantId)),
    limit: maxRecordsPerType,
  });

  // Fetch related deals
  const deals = await db.query.deals.findMany({
    where: (deals, { eq, and }) =>
      and(eq(deals.accountId, accountId), eq(deals.tenantId, tenantId)),
    limit: maxRecordsPerType,
  });

  // Fetch related tickets
  const tickets = await db.query.tickets.findMany({
    where: (tickets, { eq, and }) =>
      and(eq(tickets.accountId, accountId), eq(tickets.tenantId, tenantId)),
    limit: maxRecordsPerType,
  });

  // Build initial context data
  const contextData: ContextData = {
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      industry: account.industry,
      status: account.status,
      employeeCount: account.employeeCount,
      annualRevenue: account.annualRevenue,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      accountId: contact.accountId,
      name: contact.name,
      email: contact.email,
      title: contact.title,
      isPrimary: contact.isPrimary,
      isActive: contact.isActive,
      createdAt: contact.createdAt,
    })),
    deals: deals.map((deal) => ({
      id: deal.id,
      accountId: deal.accountId,
      name: deal.name,
      stage: deal.stage,
      amount: deal.amount,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate,
      status: deal.status,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
    })),
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      accountId: ticket.accountId,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      resolvedAt: ticket.resolvedAt,
    })),
  };

  // Calculate initial token estimate
  let estimatedTokens = estimateTokens(contextData);
  let pruned = false;
  const allPrunedFields: string[] = [];

  // If over budget, prune data
  if (estimatedTokens > maxTokens) {
    pruned = true;

    // First, limit activity history
    if (includeActivities) {
      // We'd fetch and prune activities here
      // For now, skip activities if over budget
      allPrunedFields.push('activities');
    }

    // Recalculate
    estimatedTokens = estimateTokens(contextData);

    // If still over budget, prune large text fields
    if (estimatedTokens > maxTokens) {
      // Prune ticket descriptions
      if (contextData.tickets) {
        contextData.tickets = contextData.tickets.map((ticket) => {
          const { pruned: prunedTicket, prunedFields } = pruneObject(
            ticket as Record<string, unknown>,
            1000
          );
          if (prunedFields.length > 0) {
            allPrunedFields.push(...prunedFields.map((f) => `tickets.${f}`));
          }
          return prunedTicket;
        });
      }

      estimatedTokens = estimateTokens(contextData);
    }

    // If STILL over budget, limit number of records
    if (estimatedTokens > maxTokens) {
      const reductionFactor = maxTokens / estimatedTokens;

      if (contextData.deals && contextData.deals.length > 10) {
        const newLimit = Math.max(10, Math.floor(contextData.deals.length * reductionFactor));
        contextData.deals = contextData.deals.slice(0, newLimit);
        allPrunedFields.push('deals (limited)');
      }

      if (contextData.tickets && contextData.tickets.length > 10) {
        const newLimit = Math.max(10, Math.floor(contextData.tickets.length * reductionFactor));
        contextData.tickets = contextData.tickets.slice(0, newLimit);
        allPrunedFields.push('tickets (limited)');
      }

      if (contextData.contacts && contextData.contacts.length > 10) {
        const newLimit = Math.max(10, Math.floor(contextData.contacts.length * reductionFactor));
        contextData.contacts = contextData.contacts.slice(0, newLimit);
        allPrunedFields.push('contacts (limited)');
      }

      estimatedTokens = estimateTokens(contextData);
    }
  }

  return {
    contextData,
    metadata: {
      recordCounts: {
        accounts: contextData.accounts?.length || 0,
        contacts: contextData.contacts?.length || 0,
        deals: contextData.deals?.length || 0,
        tickets: contextData.tickets?.length || 0,
      },
      estimatedTokens,
      pruned,
      prunedFields: allPrunedFields.length > 0 ? allPrunedFields : undefined,
    },
  };
}

/**
 * Assemble context for deal analysis.
 */
export async function assembleDealContext(
  dealId: string,
  tenantId: string,
  options: ContextAssemblyOptions = {}
): Promise<AssembledContext> {
  const { maxTokens = 100000, maxRecordsPerType = 1000 } = options;

  // Fetch deal data
  const deals = await db.query.deals.findMany({
    where: (deals, { eq, and }) => and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)),
    limit: 1,
  });

  if (!deals || deals.length === 0) {
    throw new Error(`Deal ${dealId} not found`);
  }

  const deal = deals[0];

  // Fetch related account
  const accounts = deal.accountId
    ? await db.query.accounts.findMany({
        where: (accounts, { eq, and }) =>
          and(eq(accounts.id, deal.accountId), eq(accounts.tenantId, tenantId)),
        limit: 1,
      })
    : [];

  // Fetch related contacts from the account
  const contacts = deal.accountId
    ? await db.query.contacts.findMany({
        where: (contacts, { eq, and }) =>
          and(eq(contacts.accountId, deal.accountId), eq(contacts.tenantId, tenantId)),
        limit: maxRecordsPerType,
      })
    : [];

  const contextData: ContextData = {
    deals: [
      {
        id: deal.id,
        accountId: deal.accountId,
        name: deal.name,
        stage: deal.stage,
        amount: deal.amount,
        probability: deal.probability,
        expectedCloseDate: deal.expectedCloseDate,
        status: deal.status,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      },
    ],
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      industry: account.industry,
      status: account.status,
    })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      title: contact.title,
      isPrimary: contact.isPrimary,
    })),
  };

  const estimatedTokens = estimateTokens(contextData);

  return {
    contextData,
    metadata: {
      recordCounts: {
        deals: 1,
        accounts: accounts.length,
        contacts: contacts.length,
      },
      estimatedTokens,
      pruned: false,
    },
  };
}

/**
 * Main context assembler that routes to the appropriate assembler based on crew type.
 */
export async function assembleContext(
  crewTemplateId: string,
  entityId: string,
  tenantId: string,
  options: ContextAssemblyOptions = {}
): Promise<AssembledContext> {
  switch (crewTemplateId) {
    case 'account_health':
      return assembleAccountHealthContext(entityId, tenantId, options);

    case 'deal_analysis':
      return assembleDealContext(entityId, tenantId, options);

    case 'ticket_analysis':
      // TODO: Implement ticket analysis context assembler
      throw new Error('Ticket analysis not yet implemented');

    default:
      throw new Error(`Unknown crew template: ${crewTemplateId}`);
  }
}
