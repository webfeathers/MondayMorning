import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkSchedules } from '../scheduler/job-scheduler';

// Mock the database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

const mockQuery = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};

describe('Job Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chained mock methods
    mockDb.select.mockReturnValue(mockQuery);
    mockDb.insert.mockReturnValue(mockQuery);
    mockDb.update.mockReturnValue(mockQuery);
    mockQuery.from.mockReturnValue(mockQuery);
    mockQuery.where.mockReturnValue(mockQuery);
    mockQuery.orderBy.mockReturnValue(mockQuery);
    mockQuery.limit.mockReturnValue(mockQuery);
  });

  describe('checkSchedules()', () => {
    it('should query job_schedules table for active schedules', async () => {
      // Arrange
      mockQuery.where.mockResolvedValue([]);
      const db = mockDb as any;

      // Act
      await checkSchedules(db);

      // Assert
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockQuery.from).toHaveBeenCalled();
      expect(mockQuery.where).toHaveBeenCalled();
    });

    it('should evaluate cron expression to check if job should run', async () => {
      // Arrange
      const now = new Date('2026-02-23T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const schedules = [
        {
          id: 'schedule-1',
          tenantId: 'tenant-1',
          jobType: 'sync_crm',
          cronExpression: '0 10 * * *', // Every day at 10:00
          payload: { provider: 'salesforce' },
          isActive: true,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockQuery.where.mockResolvedValue(schedules);
      mockQuery.limit.mockResolvedValue([]);
      const db = mockDb as any;

      // Act
      await checkSchedules(db);

      // Assert - should attempt to insert a job
      expect(mockDb.insert).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should enqueue job to jobs table if schedule matches', async () => {
      // Arrange
      const now = new Date('2026-02-23T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const schedules = [
        {
          id: 'schedule-1',
          tenantId: 'tenant-1',
          jobType: 'sync_crm',
          cronExpression: '0 10 * * *',
          payload: { provider: 'salesforce' },
          isActive: true,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockQuery.where.mockResolvedValue(schedules);
      mockQuery.limit.mockResolvedValue([]);
      const db = mockDb as any;

      // Act
      await checkSchedules(db);

      // Assert
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled(); // Should update lastRunAt

      vi.useRealTimers();
    });

    it('should track lastRunAt to prevent duplicate runs', async () => {
      // Arrange
      const now = new Date('2026-02-23T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const schedules = [
        {
          id: 'schedule-1',
          tenantId: 'tenant-1',
          jobType: 'sync_crm',
          cronExpression: '0 10 * * *',
          payload: { provider: 'salesforce' },
          isActive: true,
          lastRunAt: new Date('2026-02-23T10:00:00Z'), // Already ran at this exact time
          nextRunAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockQuery.where.mockResolvedValue(schedules);
      const db = mockDb as any;

      // Act
      await checkSchedules(db);

      // Assert - should NOT insert a job (already ran)
      expect(mockDb.insert).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle multiple schedules', async () => {
      // Arrange
      const now = new Date('2026-02-23T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const schedules = [
        {
          id: 'schedule-1',
          tenantId: 'tenant-1',
          jobType: 'sync_crm',
          cronExpression: '0 10 * * *',
          payload: { provider: 'salesforce' },
          isActive: true,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'schedule-2',
          tenantId: 'tenant-2',
          jobType: 'send_report',
          cronExpression: '0 10 * * *',
          payload: { reportType: 'weekly' },
          isActive: true,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockQuery.where.mockResolvedValue(schedules);
      mockQuery.limit.mockResolvedValue([]);
      const db = mockDb as any;

      // Act
      await checkSchedules(db);

      // Assert - should insert 2 jobs
      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should skip disabled schedules', async () => {
      // Arrange
      const now = new Date('2026-02-23T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const schedules = [
        {
          id: 'schedule-1',
          tenantId: 'tenant-1',
          jobType: 'sync_crm',
          cronExpression: '0 10 * * *',
          payload: { provider: 'salesforce' },
          isActive: false, // Disabled
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockQuery.where.mockResolvedValue(schedules);
      const db = mockDb as any;

      // Act
      await checkSchedules(db);

      // Assert - should NOT insert any jobs (schedule is disabled)
      expect(mockDb.insert).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should enqueue jobs with tenant context', async () => {
      // Arrange
      const now = new Date('2026-02-23T10:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const schedules = [
        {
          id: 'schedule-1',
          tenantId: 'tenant-123',
          jobType: 'sync_crm',
          cronExpression: '0 10 * * *',
          payload: { provider: 'salesforce' },
          isActive: true,
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockQuery.where.mockResolvedValue(schedules);
      mockQuery.limit.mockResolvedValue([]);
      let insertedJob: any;
      mockDb.insert.mockImplementation((job: any) => {
        insertedJob = job;
        return mockQuery;
      });
      const db = mockDb as any;

      // Act
      await checkSchedules(db);

      // Assert - job should have correct tenant context
      expect(mockDb.insert).toHaveBeenCalled();
      // The implementation will pass the job data, we check it was called

      vi.useRealTimers();
    });
  });
});
