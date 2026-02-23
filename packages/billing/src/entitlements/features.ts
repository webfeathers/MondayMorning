/**
 * Feature flags available across different plan tiers
 */
export const FEATURES = {
  CONFIGURABLE_DASHBOARDS: 'configurableDashboards',
  WEBHOOK_SYNC: 'webhookSync',
  WHITE_LABEL: 'whiteLabel',
  API_ACCESS: 'apiAccess',
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

/**
 * Type for plan features object
 */
export interface PlanFeatures {
  configurableDashboards: boolean;
  webhookSync: boolean;
  whiteLabel: boolean;
  apiAccess: boolean;
}
