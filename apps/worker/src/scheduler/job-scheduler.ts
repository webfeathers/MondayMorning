import { eq } from 'drizzle-orm';
import { CronExpressionParser } from 'cron-parser';
import { jobSchedules, jobs } from '@wf/db';

// Type definition for database client (compatible with Drizzle)
type DbClient = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
};

/**
 * Check all active schedules and enqueue jobs if they should run now
 * @param db - Database client (Drizzle instance)
 * @returns Number of jobs enqueued
 */
export async function checkSchedules(db: DbClient): Promise<number> {
  const now = new Date();
  let enqueuedCount = 0;

  try {
    // Query all active job schedules
    const schedules = await db
      .select()
      .from(jobSchedules)
      .where(eq(jobSchedules.isActive, true));

    for (const schedule of schedules) {
      try {
        // Parse the cron expression to get next scheduled time after lastRunAt (or now if never run)
        const referenceDate = schedule.lastRunAt || new Date(now.getTime() - 60000); // 1 minute ago if never run
        const interval = CronExpressionParser.parse(schedule.cronExpression, {
          currentDate: referenceDate,
          tz: 'UTC',
        });

        // Get the next scheduled time after the reference date
        const nextScheduledTime = interval.next().toDate();

        // Check if the next scheduled time has arrived (is in the past or within current minute)
        const shouldRun = shouldRunSchedule(schedule, nextScheduledTime, now);

        if (shouldRun) {
          // Enqueue the job
          await enqueueJob(db, schedule, now);
          enqueuedCount++;

          // Update lastRunAt to the scheduled time and calculate next run
          await updateScheduleTimestamps(db, schedule.id, nextScheduledTime, interval.next().toDate());
        }
      } catch (error) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
        // Continue processing other schedules even if one fails
      }
    }

    return enqueuedCount;
  } catch (error) {
    console.error('Error checking schedules:', error);
    throw error;
  }
}

/**
 * Determine if a schedule should run based on next scheduled time and current time
 * @param schedule - The job schedule
 * @param nextScheduledTime - When the job should run next according to cron
 * @param now - Current time
 * @returns true if job should run, false otherwise
 */
function shouldRunSchedule(
  schedule: any,
  nextScheduledTime: Date,
  now: Date
): boolean {
  const scheduledTimeMs = nextScheduledTime.getTime();
  const nowMs = now.getTime();

  // Check if the scheduled time has passed (is in the past or within the current minute)
  // Allow up to 60 seconds of grace period for minute-by-minute scheduling
  const timeSinceScheduled = nowMs - scheduledTimeMs;

  // Run if scheduled time is in the past but within the last minute
  // This ensures we catch schedules that should run now
  return timeSinceScheduled >= 0 && timeSinceScheduled < 60000;
}

/**
 * Enqueue a job to the jobs table
 * @param db - Database client
 * @param schedule - The job schedule
 * @param now - Current time
 */
async function enqueueJob(db: DbClient, schedule: any, now: Date): Promise<void> {
  await db.insert(jobs).values({
    tenantId: schedule.tenantId,
    type: schedule.jobType,
    status: 'queued',
    priority: 1, // Scheduled jobs have default priority
    payload: schedule.payload || {},
    attempts: 0,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now,
  });

  console.log(
    `Enqueued job: ${schedule.jobType} for tenant: ${schedule.tenantId}`
  );
}

/**
 * Update schedule's lastRunAt and nextRunAt timestamps
 * @param db - Database client
 * @param scheduleId - Schedule ID
 * @param lastRunAt - Last run timestamp
 * @param nextRunAt - Next run timestamp
 */
async function updateScheduleTimestamps(
  db: DbClient,
  scheduleId: string,
  lastRunAt: Date,
  nextRunAt: Date
): Promise<void> {
  await db
    .update(jobSchedules)
    .set({
      lastRunAt,
      nextRunAt,
      updatedAt: lastRunAt,
    })
    .where(eq(jobSchedules.id, scheduleId));
}

// Scheduler state
let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the job scheduler loop
 * @param db - Database client
 * @param checkInterval - How often to check schedules in milliseconds (default: 60000 = 1 minute)
 */
export function startScheduler(db: DbClient, checkInterval: number = 60000): void {
  if (isRunning) {
    console.warn('Scheduler is already running');
    return;
  }

  isRunning = true;
  console.log(`Starting job scheduler (checking every ${checkInterval}ms)`);

  // Run immediately on start
  checkSchedules(db).catch((error) => {
    console.error('Error in initial schedule check:', error);
  });

  // Then run on interval
  schedulerInterval = setInterval(async () => {
    try {
      const count = await checkSchedules(db);
      if (count > 0) {
        console.log(`Scheduler enqueued ${count} job(s)`);
      }
    } catch (error) {
      console.error('Error in scheduled check:', error);
    }
  }, checkInterval);
}

/**
 * Stop the job scheduler loop
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    isRunning = false;
    console.log('Job scheduler stopped');
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}
