/**
 * 30-day Trash lifecycle (user-visible) with the SYNC-0 tombstone rule:
 * payloads may purge after retention, tombstone metadata is retained
 * indefinitely in v1 so an offline device can never resurrect purged content.
 * Internal tombstone retention is never surfaced to users.
 */

export const TRASH_RETENTION_DAYS = 30;

export interface TrashCountdown {
  daysRemaining: number;
  purgeEligible: boolean;
  label: string;
}

const DAY_MS = 86_400_000;

export function trashCountdown(
  deletedAt: number | null | undefined,
  now: number,
  retentionDays = TRASH_RETENTION_DAYS,
): TrashCountdown {
  if (deletedAt === null || deletedAt === undefined || !Number.isFinite(deletedAt) || deletedAt <= 0) {
    return {
      daysRemaining: 0,
      purgeEligible: false,
      label: 'Deletion date unavailable',
    };
  }

  const elapsedMs = Math.max(0, now - deletedAt);
  const totalRetentionMs = retentionDays * DAY_MS;
  const purgeEligible = elapsedMs >= totalRetentionMs;
  const remainingMs = Math.max(0, totalRetentionMs - elapsedMs);

  let daysRemaining = 0;
  let label: string;

  if (purgeEligible) {
    daysRemaining = 0;
    label = 'Deletes permanently today';
  } else if (remainingMs < DAY_MS) {
    daysRemaining = 0;
    label = 'Deletes permanently today';
  } else if (remainingMs < 2 * DAY_MS) {
    daysRemaining = 1;
    label = 'Deletes permanently tomorrow';
  } else {
    daysRemaining = Math.ceil(remainingMs / DAY_MS);
    label = `Deletes permanently in ${daysRemaining} days`;
  }

  return { daysRemaining, purgeEligible, label };
}

/** Roots whose payload purge is due. Callers must journal tombstones BEFORE purging. */
export function purgeEligibleRoots(
  items: ReadonlyArray<{ id: string; deletedAt?: number | null }>,
  now: number,
  retentionDays = TRASH_RETENTION_DAYS,
): string[] {
  return items
    .filter(item => item.deletedAt !== null && trashCountdown(item.deletedAt, now, retentionDays).purgeEligible)
    .map(item => item.id);
}

/**
 * Records the retention decision for the sync layer: payload purge at 30
 * days, tombstone kept (indefinitely in v1). Returned for journaling.
 */
export function retentionDecision(now: number): { purgePayloadAfterDays: number; tombstoneRetention: 'until-all-devices-acknowledge' } {
  void now;
  return { purgePayloadAfterDays: TRASH_RETENTION_DAYS, tombstoneRetention: 'until-all-devices-acknowledge' };
}
