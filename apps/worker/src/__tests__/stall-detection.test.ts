import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectStalledJobs } from '../processor/stall-detection';
import { db, jobs } from '@wf/db';
import { JobStatus, JOB_STALL_TIMEOUT_MS } from '@wf/shared';
import { eq, and, lt, sql } from 'drizzle-orm';

// Mock the database module
vi.mock('@wf/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
  jobs: {
    id: 'id',
    status: 'status',
    lockedAt: 'locked_at',
    lockedBy: 'locked_by',
    attempts: 'attempts',
    updatedAt: 'updated_at',
  },
}));

describe('Stall Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects jobs running longer than JOB_STALL_TIMEOUT_MS', async () => {
    const stalledTime = new Date(Date.now() - JOB_STALL_TIMEOUT_MS - 60000); // 1 minute past stall timeout
    const mockStalledJob = {
      id: 'job-1',
      status: JobStatus.RUNNING,
      lockedAt: stalledTime,
      lockedBy: 'worker-1',
      attempts: 1,
    };

    // Mock database query to return a stalled job
    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([mockStalledJob]);

    (db.select as any).mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    });

    // Mock update query
    const mockSet = vi.fn().mockReturnThis();
    const mockWhereUpdate = vi.fn().mockResolvedValue({});

    (db.update as any).mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhereUpdate,
      }),
    });

    const count = await detectStalledJobs();

    expect(count).toBe(1);
    expect(db.select).toHaveBeenCalled();
  });

  it('resets job status to queued', async () => {
    const stalledTime = new Date(Date.now() - JOB_STALL_TIMEOUT_MS - 60000);
    const mockStalledJob = {
      id: 'job-1',
      status: JobStatus.RUNNING,
      lockedAt: stalledTime,
      lockedBy: 'worker-1',
      attempts: 1,
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([mockStalledJob]);

    (db.select as any).mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    });

    const mockSet = vi.fn().mockReturnThis();
    const mockWhereUpdate = vi.fn().mockResolvedValue({});

    (db.update as any).mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhereUpdate,
      }),
    });

    await detectStalledJobs();

    // Verify that update was called with status: 'queued'
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.QUEUED,
      })
    );
  });

  it('increments attempt counter', async () => {
    const stalledTime = new Date(Date.now() - JOB_STALL_TIMEOUT_MS - 60000);
    const mockStalledJob = {
      id: 'job-1',
      status: JobStatus.RUNNING,
      lockedAt: stalledTime,
      lockedBy: 'worker-1',
      attempts: 2,
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([mockStalledJob]);

    (db.select as any).mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    });

    const mockSet = vi.fn().mockReturnThis();
    const mockWhereUpdate = vi.fn().mockResolvedValue({});

    (db.update as any).mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhereUpdate,
      }),
    });

    await detectStalledJobs();

    // Verify that attempts was incremented
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 3,
      })
    );
  });

  it('clears lockedAt and lockedBy', async () => {
    const stalledTime = new Date(Date.now() - JOB_STALL_TIMEOUT_MS - 60000);
    const mockStalledJob = {
      id: 'job-1',
      status: JobStatus.RUNNING,
      lockedAt: stalledTime,
      lockedBy: 'worker-1',
      attempts: 1,
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([mockStalledJob]);

    (db.select as any).mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    });

    const mockSet = vi.fn().mockReturnThis();
    const mockWhereUpdate = vi.fn().mockResolvedValue({});

    (db.update as any).mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhereUpdate,
      }),
    });

    await detectStalledJobs();

    // Verify that lockedAt and lockedBy were cleared
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lockedAt: null,
        lockedBy: null,
      })
    );
  });

  it('respects JOB_STALL_TIMEOUT_MS constant (15 minutes)', () => {
    // Verify that the constant is correctly set to 15 minutes
    expect(JOB_STALL_TIMEOUT_MS).toBe(15 * 60 * 1000); // 900000ms
  });

  it('handles multiple stalled jobs', async () => {
    const stalledTime = new Date(Date.now() - JOB_STALL_TIMEOUT_MS - 60000);
    const mockStalledJobs = [
      {
        id: 'job-1',
        status: JobStatus.RUNNING,
        lockedAt: stalledTime,
        lockedBy: 'worker-1',
        attempts: 1,
      },
      {
        id: 'job-2',
        status: JobStatus.RUNNING,
        lockedAt: stalledTime,
        lockedBy: 'worker-2',
        attempts: 2,
      },
      {
        id: 'job-3',
        status: JobStatus.RUNNING,
        lockedAt: stalledTime,
        lockedBy: 'worker-1',
        attempts: 0,
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue(mockStalledJobs);

    (db.select as any).mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    });

    const mockSet = vi.fn().mockReturnThis();
    const mockWhereUpdate = vi.fn().mockResolvedValue({});

    (db.update as any).mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhereUpdate,
      }),
    });

    const count = await detectStalledJobs();

    expect(count).toBe(3);
    expect(mockSet).toHaveBeenCalledTimes(3);
  });

  it('returns 0 when no stalled jobs found', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([]);

    (db.select as any).mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere,
      }),
    });

    const count = await detectStalledJobs();

    expect(count).toBe(0);
  });
});
