/**
 * Trace ID generation for distributed tracing
 *
 * Generates unique trace IDs for tracking requests across services
 */

import { nanoid } from 'nanoid';

/**
 * Generate a unique trace ID for request tracking
 *
 * Uses nanoid for URL-safe, compact IDs
 */
export function generateTraceId(): string {
  return nanoid(21); // 21 chars = ~149 bits of entropy
}

/**
 * Extract trace ID from headers or generate new one
 */
export function getOrCreateTraceId(headers?: Record<string, string | undefined>): string {
  // Check for existing trace ID in headers
  const existingTraceId =
    headers?.['x-trace-id'] ||
    headers?.['x-request-id'] ||
    headers?.['traceparent']?.split('-')[1]; // W3C Trace Context format

  if (existingTraceId && typeof existingTraceId === 'string') {
    return existingTraceId;
  }

  return generateTraceId();
}

/**
 * Parse tenant ID from headers
 */
export function getTenantIdFromHeaders(headers?: Record<string, string | undefined>): string | undefined {
  return headers?.['x-tenant-id'] || headers?.['x-tenant-slug'];
}

/**
 * Parse user ID from headers
 */
export function getUserIdFromHeaders(headers?: Record<string, string | undefined>): string | undefined {
  return headers?.['x-user-id'];
}
