/**
 * Mapping Proposer - Smart field mapping suggestions
 *
 * Analyzes source CRM fields and proposes mappings to our normalized schema
 * using fuzzy matching, pattern detection, and field name conventions.
 *
 * Features:
 * - Fuzzy matching (e.g., "Account_Name" → "name", "Close_Date__c" → "closeDate")
 * - Common pattern detection (Owner_Id, Created_Date, etc.)
 * - Stage mapping suggestions based on common stage names
 * - Confidence scoring for each mapping proposal
 */

import type { FieldSchema } from '@wf/integrations';

/**
 * Proposed field mapping with confidence score
 */
export interface ProposedFieldMapping {
  sourceField: string;
  sourceLabel: string;
  sourceType: string;
  targetField: string;
  confidence: number; // 0-1, where 1 is exact match
  reason: string;
}

/**
 * Stage mapping proposal
 */
export interface ProposedStageMapping {
  sourceValue: string;
  sourceLabel: string;
  targetStage: string;
  isClosed: boolean;
  isWon: boolean;
  confidence: number;
  reason: string;
}

/**
 * Mapping proposal result
 */
export interface MappingProposal {
  fieldMappings: ProposedFieldMapping[];
  stageMappings: ProposedStageMapping[];
}

/**
 * Normalized field names we map to (for deals)
 */
const DEAL_TARGET_FIELDS = [
  'name',
  'amount',
  'currency',
  'stage',
  'probability',
  'closeDate',
  'ownerId',
  'organizationId',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Common field name patterns and their targets
 */
const FIELD_PATTERNS: Array<{ pattern: RegExp; target: string; reason: string }> = [
  // Name fields
  { pattern: /^(name|title|deal_name|opportunity_name)$/i, target: 'name', reason: 'Common name field' },
  { pattern: /^.*_?name$/i, target: 'name', reason: 'Ends with "name"' },

  // Amount fields
  { pattern: /^(amount|value|total|deal_amount|opportunity_amount)$/i, target: 'amount', reason: 'Common amount field' },
  { pattern: /^.*_?(amount|value)$/i, target: 'amount', reason: 'Contains amount/value' },

  // Currency fields
  { pattern: /^(currency|currency_code|currency_iso)$/i, target: 'currency', reason: 'Currency identifier' },

  // Stage fields
  { pattern: /^(stage|status|deal_stage|opportunity_stage|sales_stage)$/i, target: 'stage', reason: 'Common stage field' },
  { pattern: /^.*_?(stage|status)$/i, target: 'stage', reason: 'Contains stage/status' },

  // Probability fields
  { pattern: /^(probability|win_probability|close_probability|percent|likelihood)$/i, target: 'probability', reason: 'Probability indicator' },

  // Close date fields
  { pattern: /^(close_date|closing_date|expected_close|close_at|target_close)$/i, target: 'closeDate', reason: 'Common close date field' },
  { pattern: /^.*_?(close|closing)_?(date|at)$/i, target: 'closeDate', reason: 'Contains close date pattern' },

  // Owner fields
  { pattern: /^(owner_id|owner|assigned_to|sales_rep_id|rep_id)$/i, target: 'ownerId', reason: 'Common owner field' },
  { pattern: /^.*_?owner(_id)?$/i, target: 'ownerId', reason: 'Contains owner' },

  // Organization/Account fields
  { pattern: /^(account_id|company_id|organization_id|customer_id)$/i, target: 'organizationId', reason: 'Account reference' },
  { pattern: /^.*_?(account|company|organization)_?id$/i, target: 'organizationId', reason: 'Contains account/company ID' },

  // Created date fields
  { pattern: /^(created_at|created_date|create_date|date_created)$/i, target: 'createdAt', reason: 'Creation timestamp' },
  { pattern: /^.*_?created(_at|_date)?$/i, target: 'createdAt', reason: 'Contains created' },

  // Updated date fields
  { pattern: /^(updated_at|modified_at|last_modified|date_modified)$/i, target: 'updatedAt', reason: 'Modification timestamp' },
  { pattern: /^.*_?(updated|modified)(_at|_date)?$/i, target: 'updatedAt', reason: 'Contains updated/modified' },
];

/**
 * Common stage name mappings
 */
const STAGE_PATTERNS: Array<{
  pattern: RegExp;
  targetStage: string;
  isClosed: boolean;
  isWon: boolean;
  reason: string;
}> = [
  // Won stages
  { pattern: /^(closed_won|won|closed won|deal won)$/i, targetStage: 'closed_won', isClosed: true, isWon: true, reason: 'Won stage' },
  { pattern: /^(complete|completed|success|successful)$/i, targetStage: 'closed_won', isClosed: true, isWon: true, reason: 'Success indicator' },

  // Lost stages
  { pattern: /^(closed_lost|lost|closed lost|deal lost)$/i, targetStage: 'closed_lost', isClosed: true, isWon: false, reason: 'Lost stage' },
  { pattern: /^(failed|cancelled|canceled|dead|rejected)$/i, targetStage: 'closed_lost', isClosed: true, isWon: false, reason: 'Failure indicator' },

  // Active stages
  { pattern: /^(prospecting|lead|new|initial)$/i, targetStage: 'prospecting', isClosed: false, isWon: false, reason: 'Early stage' },
  { pattern: /^(qualification|qualified|qualifying)$/i, targetStage: 'qualification', isClosed: false, isWon: false, reason: 'Qualification stage' },
  { pattern: /^(proposal|quote|quoting)$/i, targetStage: 'proposal', isClosed: false, isWon: false, reason: 'Proposal stage' },
  { pattern: /^(negotiation|negotiating|contract)$/i, targetStage: 'negotiation', isClosed: false, isWon: false, reason: 'Negotiation stage' },
];

/**
 * Normalize field name for comparison
 * Removes special characters, underscores, and converts to lowercase
 */
function normalizeFieldName(name: string): string {
  return name
    .replace(/[_\s-]+/g, '') // Remove underscores, spaces, hyphens
    .replace(/__c$/i, '') // Remove Salesforce custom field suffix
    .toLowerCase();
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate fuzzy match confidence between source and target field names
 * Returns 0-1 where 1 is exact match
 */
function calculateFuzzyMatchConfidence(sourceName: string, targetName: string): number {
  const normalizedSource = normalizeFieldName(sourceName);
  const normalizedTarget = normalizeFieldName(targetName);

  // Exact match after normalization
  if (normalizedSource === normalizedTarget) {
    return 1.0;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedSource, normalizedTarget);
  const maxLength = Math.max(normalizedSource.length, normalizedTarget.length);

  // Convert distance to similarity (0-1)
  const similarity = 1 - distance / maxLength;

  // Only consider matches with >70% similarity
  return similarity > 0.7 ? similarity : 0;
}

/**
 * Propose field mapping for a single source field
 */
function proposeFieldMapping(sourceField: FieldSchema): ProposedFieldMapping | null {
  // First, try pattern matching
  for (const { pattern, target, reason } of FIELD_PATTERNS) {
    if (pattern.test(sourceField.name)) {
      return {
        sourceField: sourceField.name,
        sourceLabel: sourceField.label,
        sourceType: sourceField.type,
        targetField: target,
        confidence: 0.9, // Pattern match = high confidence
        reason,
      };
    }
  }

  // Fall back to fuzzy matching
  let bestMatch: ProposedFieldMapping | null = null;
  let bestConfidence = 0;

  for (const targetField of DEAL_TARGET_FIELDS) {
    const confidence = calculateFuzzyMatchConfidence(sourceField.name, targetField);

    if (confidence > bestConfidence && confidence > 0.7) {
      bestConfidence = confidence;
      bestMatch = {
        sourceField: sourceField.name,
        sourceLabel: sourceField.label,
        sourceType: sourceField.type,
        targetField,
        confidence,
        reason: `Fuzzy match (${Math.round(confidence * 100)}% similar)`,
      };
    }
  }

  return bestMatch;
}

/**
 * Propose stage mappings from picklist values
 */
function proposeStageMapping(sourceValue: string, sourceLabel: string): ProposedStageMapping | null {
  // Try pattern matching
  for (const { pattern, targetStage, isClosed, isWon, reason } of STAGE_PATTERNS) {
    if (pattern.test(sourceValue) || pattern.test(sourceLabel)) {
      return {
        sourceValue,
        sourceLabel,
        targetStage,
        isClosed,
        isWon,
        confidence: 0.9,
        reason,
      };
    }
  }

  // No match found
  return null;
}

/**
 * Propose field mappings for a CRM object
 *
 * @param sourceFields - Field schemas from CRM
 * @param targetObject - Target object type (e.g., 'Deal')
 * @returns Proposed field mappings and stage mappings
 *
 * @example
 * ```typescript
 * const fields = await adapter.discoverFields('Opportunity');
 * const proposal = proposeMappings(fields, 'Deal');
 *
 * // {
 * //   fieldMappings: [
 * //     { sourceField: 'Amount', targetField: 'amount', confidence: 1.0, ... },
 * //     { sourceField: 'Close_Date__c', targetField: 'closeDate', confidence: 0.9, ... }
 * //   ],
 * //   stageMappings: [
 * //     { sourceValue: 'closed_won', targetStage: 'closed_won', isClosed: true, isWon: true, ... }
 * //   ]
 * // }
 * ```
 */
export function proposeMappings(
  sourceFields: FieldSchema[],
  targetObject: string
): MappingProposal {
  const fieldMappings: ProposedFieldMapping[] = [];
  const stageMappings: ProposedStageMapping[] = [];

  // Process each source field
  for (const sourceField of sourceFields) {
    // Skip ID fields (not mapped to user fields)
    if (sourceField.type === 'id') {
      continue;
    }

    // If this is a stage/status picklist, propose stage mappings
    if (
      sourceField.type === 'picklist' &&
      (sourceField.name.toLowerCase().includes('stage') ||
        sourceField.name.toLowerCase().includes('status'))
    ) {
      if (sourceField.picklistValues) {
        for (const picklistValue of sourceField.picklistValues) {
          const stageMapping = proposeStageMapping(picklistValue.value, picklistValue.label);
          if (stageMapping) {
            stageMappings.push(stageMapping);
          }
        }
      }
    }

    // Propose field mapping
    const mapping = proposeFieldMapping(sourceField);
    if (mapping) {
      fieldMappings.push(mapping);
    }
  }

  // Sort by confidence (highest first)
  fieldMappings.sort((a, b) => b.confidence - a.confidence);
  stageMappings.sort((a, b) => b.confidence - a.confidence);

  return {
    fieldMappings,
    stageMappings,
  };
}
