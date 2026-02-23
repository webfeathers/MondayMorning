import { describe, it, expect } from 'vitest';
import {
  mapFields,
  coerceValue,
  applyTransform,
  normalizeStage,
  validateRecord,
  extractCustomFields,
} from '../core/field-mapper';
import type { FieldMapping, StageMapping, ValidationRule } from '../types/sync-types';

describe('Field Mapper Pipeline', () => {
  describe('coerceValue', () => {
    it('coerces string to number', () => {
      expect(coerceValue('123', 'number')).toBe(123);
      expect(coerceValue('45.67', 'number')).toBe(45.67);
    });

    it('coerces string to number and returns null for invalid values', () => {
      expect(coerceValue('invalid', 'number')).toBeNull();
      expect(coerceValue('', 'number')).toBeNull();
    });

    it('parses ISO date strings to Date objects', () => {
      const result = coerceValue('2024-01-15T10:30:00Z', 'date');
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('returns null for invalid date strings', () => {
      expect(coerceValue('not-a-date', 'date')).toBeNull();
      expect(coerceValue('', 'date')).toBeNull();
    });

    it('coerces to boolean', () => {
      expect(coerceValue('true', 'boolean')).toBe(true);
      expect(coerceValue('false', 'boolean')).toBe(false);
      expect(coerceValue('1', 'boolean')).toBe(true);
      expect(coerceValue('0', 'boolean')).toBe(false);
      expect(coerceValue(1, 'boolean')).toBe(true);
      expect(coerceValue(0, 'boolean')).toBe(false);
    });

    it('returns string values unchanged for string type', () => {
      expect(coerceValue('hello', 'string')).toBe('hello');
      expect(coerceValue(123, 'string')).toBe('123');
    });

    it('handles null and undefined values', () => {
      expect(coerceValue(null, 'string')).toBeNull();
      expect(coerceValue(undefined, 'string')).toBeNull();
      expect(coerceValue(null, 'number')).toBeNull();
      expect(coerceValue(undefined, 'date')).toBeNull();
    });
  });

  describe('applyTransform', () => {
    it('applies uppercase transform', () => {
      expect(applyTransform('hello world', 'uppercase')).toBe('HELLO WORLD');
    });

    it('applies lowercase transform', () => {
      expect(applyTransform('HELLO WORLD', 'lowercase')).toBe('hello world');
    });

    it('applies trim transform', () => {
      expect(applyTransform('  hello  ', 'trim')).toBe('hello');
    });

    it('applies parseDate transform', () => {
      const result = applyTransform('2024-01-15', 'parseDate');
      expect(result).toBeInstanceOf(Date);
    });

    it('applies parseNumber transform', () => {
      expect(applyTransform('123.45', 'parseNumber')).toBe(123.45);
      expect(applyTransform('$1,234.56', 'parseNumber')).toBe(1234.56);
    });

    it('returns value unchanged for unknown transform', () => {
      expect(applyTransform('hello', 'unknown')).toBe('hello');
    });

    it('handles null values gracefully', () => {
      expect(applyTransform(null, 'uppercase')).toBeNull();
      expect(applyTransform(undefined, 'trim')).toBeNull();
    });
  });

  describe('mapFields', () => {
    it('maps source fields to target fields', () => {
      const rawRecord = {
        OpportunityName: 'Big Deal',
        Amount: '50000',
        Stage: 'Proposal',
      };

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'OpportunityName', targetField: 'name' },
        { sourceField: 'Amount', targetField: 'amount' },
        { sourceField: 'Stage', targetField: 'stage' },
      ];

      const result = mapFields(rawRecord, fieldMappings);

      expect(result).toEqual({
        name: 'Big Deal',
        amount: '50000',
        stage: 'Proposal',
      });
    });

    it('applies type coercion during mapping', () => {
      const rawRecord = {
        Amount: '50000',
        Probability: '75',
        CloseDate: '2024-12-31',
      };

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'Amount', targetField: 'amount' },
        { sourceField: 'Probability', targetField: 'probability' },
        { sourceField: 'CloseDate', targetField: 'closeDate' },
      ];

      const result = mapFields(rawRecord, fieldMappings, {
        amount: 'number',
        probability: 'number',
        closeDate: 'date',
      });

      expect(result.amount).toBe(50000);
      expect(result.probability).toBe(75);
      expect(result.closeDate).toBeInstanceOf(Date);
    });

    it('applies transformation functions', () => {
      const rawRecord = {
        CompanyName: '  acme corp  ',
        Email: 'JOHN@EXAMPLE.COM',
      };

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'CompanyName', targetField: 'name', transform: 'trim' },
        { sourceField: 'Email', targetField: 'email', transform: 'lowercase' },
      ];

      const result = mapFields(rawRecord, fieldMappings);

      expect(result.name).toBe('acme corp');
      expect(result.email).toBe('john@example.com');
    });

    it('applies default values for missing fields', () => {
      const rawRecord = {
        Name: 'Test Deal',
      };

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'Name', targetField: 'name' },
        { sourceField: 'Amount', targetField: 'amount', defaultValue: 0 },
        { sourceField: 'Currency', targetField: 'currency', defaultValue: 'USD' },
      ];

      const result = mapFields(rawRecord, fieldMappings);

      expect(result.name).toBe('Test Deal');
      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
    });

    it('handles nested source fields with dot notation', () => {
      const rawRecord = {
        Account: {
          Name: 'Acme Corp',
          Owner: {
            Id: 'user-123',
          },
        },
      };

      const fieldMappings: FieldMapping[] = [
        { sourceField: 'Account.Name', targetField: 'accountName' },
        { sourceField: 'Account.Owner.Id', targetField: 'ownerId' },
      ];

      const result = mapFields(rawRecord, fieldMappings);

      expect(result.accountName).toBe('Acme Corp');
      expect(result.ownerId).toBe('user-123');
    });
  });

  describe('normalizeStage', () => {
    const stageMappings: StageMapping[] = [
      { sourceStage: 'Prospecting', targetStage: 'prospecting', isClosed: false, isWon: false },
      { sourceStage: 'Qualification', targetStage: 'qualified', isClosed: false, isWon: false },
      { sourceStage: 'Proposal', targetStage: 'proposal', isClosed: false, isWon: false },
      { sourceStage: 'Negotiation', targetStage: 'negotiation', isClosed: false, isWon: false },
      { sourceStage: 'Closed Won', targetStage: 'won', isClosed: true, isWon: true },
      { sourceStage: 'Closed Lost', targetStage: 'lost', isClosed: true, isWon: false },
    ];

    it('normalizes stage using stage mappings', () => {
      const result = normalizeStage('Proposal', stageMappings);
      expect(result.stage).toBe('proposal');
      expect(result.isClosed).toBe(false);
      expect(result.isWon).toBe(false);
    });

    it('sets isClosed and isWon flags for won deals', () => {
      const result = normalizeStage('Closed Won', stageMappings);
      expect(result.stage).toBe('won');
      expect(result.isClosed).toBe(true);
      expect(result.isWon).toBe(true);
    });

    it('sets isClosed and isWon flags for lost deals', () => {
      const result = normalizeStage('Closed Lost', stageMappings);
      expect(result.stage).toBe('lost');
      expect(result.isClosed).toBe(true);
      expect(result.isWon).toBe(false);
    });

    it('returns original stage if no mapping found', () => {
      const result = normalizeStage('Unknown Stage', stageMappings);
      expect(result.stage).toBe('Unknown Stage');
      expect(result.isClosed).toBe(false);
      expect(result.isWon).toBe(false);
    });

    it('handles null or empty stage values', () => {
      const result = normalizeStage(null, stageMappings);
      expect(result.stage).toBeNull();
      expect(result.isClosed).toBe(false);
      expect(result.isWon).toBe(false);
    });
  });

  describe('validateRecord', () => {
    it('validates required fields', () => {
      const record = {
        name: 'Test Deal',
        amount: 5000,
      };

      const validationRules: ValidationRule[] = [
        { type: 'required', params: { field: 'name' }, message: 'Name is required' },
        { type: 'required', params: { field: 'amount' }, message: 'Amount is required' },
      ];

      const result = validateRecord(record, validationRules);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns errors for missing required fields', () => {
      const record = {
        name: 'Test Deal',
      };

      const validationRules: ValidationRule[] = [
        { type: 'required', params: { field: 'name' }, message: 'Name is required' },
        { type: 'required', params: { field: 'amount' }, message: 'Amount is required' },
      ];

      const result = validateRecord(record, validationRules);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Amount is required');
    });

    it('validates format using regex', () => {
      const record = {
        email: 'invalid-email',
      };

      const validationRules: ValidationRule[] = [
        {
          type: 'format',
          params: { field: 'email', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
          message: 'Invalid email format',
        },
      ];

      const result = validateRecord(record, validationRules);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('validates numeric ranges', () => {
      const record = {
        probability: 150,
      };

      const validationRules: ValidationRule[] = [
        {
          type: 'range',
          params: { field: 'probability', min: 0, max: 100 },
          message: 'Probability must be between 0 and 100',
        },
      ];

      const result = validateRecord(record, validationRules);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Probability must be between 0 and 100');
    });

    it('validates enum values', () => {
      const record = {
        currency: 'XYZ',
      };

      const validationRules: ValidationRule[] = [
        {
          type: 'enum',
          params: { field: 'currency', values: ['USD', 'EUR', 'GBP'] },
          message: 'Invalid currency',
        },
      ];

      const result = validateRecord(record, validationRules);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid currency');
    });

    it('passes validation when all rules are satisfied', () => {
      const record = {
        name: 'Test Deal',
        amount: 5000,
        email: 'test@example.com',
        probability: 75,
        currency: 'USD',
      };

      const validationRules: ValidationRule[] = [
        { type: 'required', params: { field: 'name' }, message: 'Name is required' },
        { type: 'required', params: { field: 'amount' }, message: 'Amount is required' },
        {
          type: 'format',
          params: { field: 'email', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
          message: 'Invalid email format',
        },
        {
          type: 'range',
          params: { field: 'probability', min: 0, max: 100 },
          message: 'Probability must be between 0 and 100',
        },
        {
          type: 'enum',
          params: { field: 'currency', values: ['USD', 'EUR', 'GBP'] },
          message: 'Invalid currency',
        },
      ];

      const result = validateRecord(record, validationRules);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('extractCustomFields', () => {
    it('extracts unmapped fields as custom fields', () => {
      const rawRecord = {
        Id: '12345',
        Name: 'Test Deal',
        Amount: 5000,
        CustomField1__c: 'Custom Value 1',
        CustomField2__c: 'Custom Value 2',
      };

      const knownFields = ['Id', 'Name', 'Amount'];

      const result = extractCustomFields(rawRecord, knownFields);

      expect(result).toEqual({
        CustomField1__c: 'Custom Value 1',
        CustomField2__c: 'Custom Value 2',
      });
    });

    it('returns empty object when no custom fields exist', () => {
      const rawRecord = {
        Id: '12345',
        Name: 'Test Deal',
        Amount: 5000,
      };

      const knownFields = ['Id', 'Name', 'Amount'];

      const result = extractCustomFields(rawRecord, knownFields);

      expect(result).toEqual({});
    });

    it('excludes null and undefined custom field values', () => {
      const rawRecord = {
        Id: '12345',
        Name: 'Test Deal',
        CustomField1__c: 'Value',
        CustomField2__c: null,
        CustomField3__c: undefined,
      };

      const knownFields = ['Id', 'Name'];

      const result = extractCustomFields(rawRecord, knownFields);

      expect(result).toEqual({
        CustomField1__c: 'Value',
      });
    });

    it('handles nested custom field values', () => {
      const rawRecord = {
        Id: '12345',
        Name: 'Test Deal',
        CustomObject__r: {
          Field1: 'Value1',
          Field2: 'Value2',
        },
      };

      const knownFields = ['Id', 'Name'];

      const result = extractCustomFields(rawRecord, knownFields);

      expect(result).toEqual({
        CustomObject__r: {
          Field1: 'Value1',
          Field2: 'Value2',
        },
      });
    });
  });
});
