import { describe, it, expect } from 'vitest';
import {
  crewTemplates,
  tenantCrewOverrides,
  tenantAiSettings,
  aiUsage,
  jobs,
  jobSchedules,
  notificationRules,
  notifications,
  auditLog,
  permissions,
  platformAdmins,
  tenantAuthSettings,
  dashboardConfigs,
  tenantBranding,
  tenantApiKeys
} from '../schema';

describe('AI, Worker, Notification, Audit, and Remaining Schema', () => {
  describe('Crew Templates', () => {
    it('crew_templates table has required columns', () => {
      const columns = Object.keys(crewTemplates);
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('slug');
      expect(columns).toContain('description');
      expect(columns).toContain('maxContext');
      expect(columns).toContain('estimatedCreditCost');
      expect(columns).toContain('config');
      expect(columns).toContain('isActive');
    });
  });

  describe('Tenant Crew Overrides', () => {
    it('tenant_crew_overrides table has required columns', () => {
      const columns = Object.keys(tenantCrewOverrides);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('crewTemplateId');
      expect(columns).toContain('isEnabled');
      expect(columns).toContain('overrideConfig');
    });
  });

  describe('Tenant AI Settings', () => {
    it('tenant_ai_settings table has required columns', () => {
      const columns = Object.keys(tenantAiSettings);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('preferredModel');
      expect(columns).toContain('maxConcurrentCrews');
      expect(columns).toContain('autoRunEnabled');
      expect(columns).toContain('createdAt');
    });
  });

  describe('AI Usage', () => {
    it('ai_usage table has required columns', () => {
      const columns = Object.keys(aiUsage);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('crewTemplateId');
      expect(columns).toContain('jobId');
      expect(columns).toContain('model');
      expect(columns).toContain('inputTokens');
      expect(columns).toContain('outputTokens');
      expect(columns).toContain('creditsUsed');
      expect(columns).toContain('executionTimeMs');
    });
  });

  describe('Jobs', () => {
    it('jobs table has required columns', () => {
      const columns = Object.keys(jobs);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('type');
      expect(columns).toContain('status');
      expect(columns).toContain('priority');
      expect(columns).toContain('payload');
      expect(columns).toContain('result');
      expect(columns).toContain('error');
      expect(columns).toContain('attempts');
      expect(columns).toContain('maxAttempts');
      expect(columns).toContain('lockedBy');
      expect(columns).toContain('lockedAt');
      expect(columns).toContain('completedAt');
    });
  });

  describe('Job Schedules', () => {
    it('job_schedules table has required columns', () => {
      const columns = Object.keys(jobSchedules);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('jobType');
      expect(columns).toContain('cronExpression');
      expect(columns).toContain('payload');
      expect(columns).toContain('isActive');
      expect(columns).toContain('lastRunAt');
      expect(columns).toContain('nextRunAt');
    });
  });

  describe('Notification Rules', () => {
    it('notification_rules table has required columns', () => {
      const columns = Object.keys(notificationRules);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('userId');
      expect(columns).toContain('eventType');
      expect(columns).toContain('channel');
      expect(columns).toContain('isEnabled');
    });
  });

  describe('Notifications', () => {
    it('notifications table has required columns', () => {
      const columns = Object.keys(notifications);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('userId');
      expect(columns).toContain('eventType');
      expect(columns).toContain('title');
      expect(columns).toContain('message');
      expect(columns).toContain('metadata');
      expect(columns).toContain('isRead');
      expect(columns).toContain('readAt');
    });
  });

  describe('Audit Log', () => {
    it('audit_log table has required columns', () => {
      const columns = Object.keys(auditLog);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('userId');
      expect(columns).toContain('action');
      expect(columns).toContain('resource');
      expect(columns).toContain('resourceId');
      expect(columns).toContain('metadata');
      expect(columns).toContain('ipAddress');
      expect(columns).toContain('userAgent');
    });
  });

  describe('Permissions', () => {
    it('permissions table has required columns', () => {
      const columns = Object.keys(permissions);
      expect(columns).toContain('id');
      expect(columns).toContain('resource');
      expect(columns).toContain('action');
      expect(columns).toContain('description');
      expect(columns).toContain('requiredRole');
    });
  });

  describe('Platform Admins', () => {
    it('platform_admins table has required columns', () => {
      const columns = Object.keys(platformAdmins);
      expect(columns).toContain('id');
      expect(columns).toContain('userId');
      expect(columns).toContain('isSuperAdmin');
      expect(columns).toContain('permissions');
    });
  });

  describe('Tenant Auth Settings', () => {
    it('tenant_auth_settings table has required columns', () => {
      const columns = Object.keys(tenantAuthSettings);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('ssoEnabled');
      expect(columns).toContain('ssoProvider');
      expect(columns).toContain('ssoConfig');
      expect(columns).toContain('sessionDurationMs');
    });
  });

  describe('Dashboard Configs', () => {
    it('dashboard_configs table has required columns', () => {
      const columns = Object.keys(dashboardConfigs);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('userId');
      expect(columns).toContain('role');
      expect(columns).toContain('layout');
      expect(columns).toContain('widgets');
    });
  });

  describe('Tenant Branding', () => {
    it('tenant_branding table has required columns', () => {
      const columns = Object.keys(tenantBranding);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('logoUrl');
      expect(columns).toContain('primaryColor');
      expect(columns).toContain('accentColor');
      expect(columns).toContain('customCss');
    });
  });

  describe('Tenant API Keys', () => {
    it('tenant_api_keys table has required columns', () => {
      const columns = Object.keys(tenantApiKeys);
      expect(columns).toContain('id');
      expect(columns).toContain('tenantId');
      expect(columns).toContain('name');
      expect(columns).toContain('keyHash');
      expect(columns).toContain('lastUsedAt');
      expect(columns).toContain('expiresAt');
      expect(columns).toContain('revokedAt');
    });
  });
});
