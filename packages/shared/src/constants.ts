export const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const TRIAL_DURATION_DAYS = 14;
export const DATA_RETENTION_DAYS = 90;
export const MAX_CONCURRENT_JOBS_PER_TENANT = 2;
export const JOB_STALL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const CREDIT_WARNING_THRESHOLD = 0.8; // 80%

export const JOB_PRIORITY = {
  WEBHOOK: 10,
  USER_INITIATED: 5,
  SCHEDULED: 1,
  BULK: 0,
} as const;
