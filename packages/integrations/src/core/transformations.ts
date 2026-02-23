/**
 * Transformation registry for field mapping pipeline.
 *
 * Provides built-in transformation functions and a registry pattern
 * for extensibility. Transformations are applied to field values
 * during the mapping process.
 */

export type TransformFunction = (value: any) => any;

/**
 * Built-in transformation functions.
 */
const builtInTransforms: Record<string, TransformFunction> = {
  /**
   * Convert string to uppercase.
   */
  uppercase: (value: any): string | null => {
    if (value === null || value === undefined) return null;
    return String(value).toUpperCase();
  },

  /**
   * Convert string to lowercase.
   */
  lowercase: (value: any): string | null => {
    if (value === null || value === undefined) return null;
    return String(value).toLowerCase();
  },

  /**
   * Trim whitespace from string.
   */
  trim: (value: any): string | null => {
    if (value === null || value === undefined) return null;
    return String(value).trim();
  },

  /**
   * Parse string to Date object.
   * Supports ISO 8601 date strings.
   */
  parseDate: (value: any): Date | null => {
    if (value === null || value === undefined) return null;

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  },

  /**
   * Parse string to number.
   * Handles currency formatting (removes $, commas).
   */
  parseNumber: (value: any): number | null => {
    if (value === null || value === undefined) return null;

    // Remove currency symbols and commas
    const cleaned = String(value).replace(/[$,]/g, '');
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? null : parsed;
  },
};

/**
 * Custom transformation registry.
 * Allows registration of additional transformations at runtime.
 */
const customTransforms: Record<string, TransformFunction> = {};

/**
 * Register a custom transformation function.
 *
 * @param name - Unique name for the transformation
 * @param fn - Transformation function
 */
export function registerTransform(name: string, fn: TransformFunction): void {
  if (builtInTransforms[name]) {
    throw new Error(`Cannot override built-in transform: ${name}`);
  }
  customTransforms[name] = fn;
}

/**
 * Get a transformation function by name.
 *
 * @param name - Name of the transformation
 * @returns Transformation function or undefined if not found
 */
export function getTransform(name: string): TransformFunction | undefined {
  return builtInTransforms[name] || customTransforms[name];
}

/**
 * List all available transformation names.
 *
 * @returns Array of transformation names
 */
export function listTransforms(): string[] {
  return [...Object.keys(builtInTransforms), ...Object.keys(customTransforms)];
}
