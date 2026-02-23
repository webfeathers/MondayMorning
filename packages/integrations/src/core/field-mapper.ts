/**
 * Field mapper pipeline - Core transformation engine.
 *
 * Provides functions for mapping provider-specific fields to normalized schema,
 * including type coercion, validation, stage normalization, and custom field extraction.
 */

import type { FieldMapping, StageMapping, ValidationRule } from '../types/sync-types';
import { getTransform } from './transformations';

/**
 * Type coercion targets.
 */
type TargetType = 'string' | 'number' | 'boolean' | 'date';

/**
 * Type coercion map for field mappings.
 */
type TypeCoercionMap = Record<string, TargetType>;

/**
 * Validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Stage normalization result.
 */
export interface StageNormalizationResult {
  stage: string | null;
  isClosed: boolean;
  isWon: boolean;
}

/**
 * Coerce a value to a target type with validation.
 *
 * @param value - Value to coerce
 * @param targetType - Target type (string, number, boolean, date)
 * @returns Coerced value or null if coercion fails
 */
export function coerceValue(value: any, targetType: TargetType): any {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return null;
  }

  switch (targetType) {
    case 'string':
      return String(value);

    case 'number': {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() === '') return null;

      const parsed = parseFloat(String(value));
      return isNaN(parsed) ? null : parsed;
    }

    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
      }
      return Boolean(value);
    }

    case 'date': {
      if (value instanceof Date) return value;
      if (typeof value === 'string' && value.trim() === '') return null;

      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    default:
      return value;
  }
}

/**
 * Apply a transformation function to a value.
 *
 * @param value - Value to transform
 * @param transform - Name of the transformation function
 * @returns Transformed value
 */
export function applyTransform(value: any, transform: string): any {
  const transformFn = getTransform(transform);

  if (!transformFn) {
    // Unknown transform - return value unchanged
    return value;
  }

  return transformFn(value);
}

/**
 * Get nested value from object using dot notation.
 *
 * @param obj - Object to extract value from
 * @param path - Dot-separated path (e.g., 'Account.Owner.Id')
 * @returns Value at path or undefined if not found
 */
function getNestedValue(obj: any, path: string): any {
  if (!path.includes('.')) {
    return obj[path];
  }

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Map raw provider fields to normalized fields.
 *
 * Applies field mappings, type coercion, transformations, and default values.
 *
 * @param rawRecord - Raw record from provider
 * @param fieldMappings - Field mapping configurations
 * @param typeCoercion - Optional type coercion map
 * @returns Mapped record with normalized field names
 */
export function mapFields(
  rawRecord: Record<string, any>,
  fieldMappings: FieldMapping[],
  typeCoercion?: TypeCoercionMap
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const mapping of fieldMappings) {
    const { sourceField, targetField, transform, defaultValue } = mapping;

    // Get value from source field (supports nested paths)
    let value = getNestedValue(rawRecord, sourceField);

    // Apply default value if source field is missing or null
    if (value === null || value === undefined) {
      if (defaultValue !== undefined) {
        value = defaultValue;
      }
    }

    // Apply transformation if specified
    if (transform && value !== null && value !== undefined) {
      value = applyTransform(value, transform);
    }

    // Apply type coercion if specified
    if (typeCoercion && typeCoercion[targetField]) {
      value = coerceValue(value, typeCoercion[targetField]);
    }

    // Set the mapped value
    result[targetField] = value;
  }

  return result;
}

/**
 * Normalize a stage value using stage mappings.
 *
 * Maps provider-specific stage names to normalized stages and sets
 * is_closed/is_won flags for CRM-agnostic queries.
 *
 * @param sourceStage - Source stage name from provider
 * @param stageMappings - Stage mapping configurations
 * @returns Normalized stage with metadata
 */
export function normalizeStage(
  sourceStage: string | null | undefined,
  stageMappings: StageMapping[]
): StageNormalizationResult {
  // Handle null/undefined stages
  if (sourceStage === null || sourceStage === undefined) {
    return {
      stage: null,
      isClosed: false,
      isWon: false,
    };
  }

  // Find matching stage mapping
  const mapping = stageMappings.find((m) => m.sourceStage === sourceStage);

  if (mapping) {
    return {
      stage: mapping.targetStage,
      isClosed: mapping.isClosed,
      isWon: mapping.isWon,
    };
  }

  // No mapping found - return original stage with default flags
  return {
    stage: sourceStage,
    isClosed: false,
    isWon: false,
  };
}

/**
 * Validate a mapped record using validation rules.
 *
 * @param record - Mapped record to validate
 * @param validationRules - Validation rules to apply
 * @returns Validation result with errors
 */
export function validateRecord(
  record: Record<string, any>,
  validationRules: ValidationRule[]
): ValidationResult {
  const errors: string[] = [];

  for (const rule of validationRules) {
    const { type, params, message } = rule;

    switch (type) {
      case 'required': {
        const field = params?.field;
        if (field && (record[field] === null || record[field] === undefined)) {
          errors.push(message || `Field ${field} is required`);
        }
        break;
      }

      case 'format': {
        const field = params?.field;
        const pattern = params?.pattern;
        if (field && pattern && record[field] !== null && record[field] !== undefined) {
          const regex = new RegExp(pattern);
          if (!regex.test(String(record[field]))) {
            errors.push(message || `Field ${field} has invalid format`);
          }
        }
        break;
      }

      case 'range': {
        const field = params?.field;
        const min = params?.min;
        const max = params?.max;
        if (field && record[field] !== null && record[field] !== undefined) {
          const value = Number(record[field]);
          if (!isNaN(value)) {
            if (min !== undefined && value < min) {
              errors.push(message || `Field ${field} is below minimum value ${min}`);
            }
            if (max !== undefined && value > max) {
              errors.push(message || `Field ${field} is above maximum value ${max}`);
            }
          }
        }
        break;
      }

      case 'enum': {
        const field = params?.field;
        const values = params?.values;
        if (field && values && Array.isArray(values)) {
          if (record[field] !== null && record[field] !== undefined) {
            if (!values.includes(record[field])) {
              errors.push(message || `Field ${field} has invalid value`);
            }
          }
        }
        break;
      }

      default:
        // Unknown validation type - skip
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract custom fields from raw record.
 *
 * Returns all fields that are not in the known fields list.
 * Filters out null/undefined values.
 *
 * @param rawRecord - Raw record from provider
 * @param knownFields - List of known/mapped field names
 * @returns Custom fields object
 */
export function extractCustomFields(
  rawRecord: Record<string, any>,
  knownFields: string[]
): Record<string, any> {
  const customFields: Record<string, any> = {};

  for (const [key, value] of Object.entries(rawRecord)) {
    // Skip if field is in known fields list
    if (knownFields.includes(key)) {
      continue;
    }

    // Skip null/undefined values
    if (value === null || value === undefined) {
      continue;
    }

    customFields[key] = value;
  }

  return customFields;
}
