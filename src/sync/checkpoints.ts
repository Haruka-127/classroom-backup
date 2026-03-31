import type { Repositories } from "../storage/repositories/index.js";

export function loadCommittedCheckpoint(repositories: Repositories, accountKey: string) {
  return repositories.syncCheckpoints.load(accountKey);
}

export function capturePendingStartPageToken(repositories: Repositories, runId: string, token: string | null): void {
  const existing = repositories.syncRuns.get(runId);
  if (!existing) {
    throw new Error(`Sync run ${runId} not found.`);
  }

  repositories.syncRuns.upsert({
    ...existing,
    driveStartPageTokenCandidate: token,
  });
}

export function commitPendingCheckpoint(repositories: Repositories, accountKey: string, runId: string, classroomSyncAt: string): void {
  const run = repositories.syncRuns.get(runId);
  if (!run) {
    throw new Error(`Sync run ${runId} not found.`);
  }

  repositories.syncCheckpoints.commit(accountKey, run.driveStartPageTokenCandidate ?? null, runId, classroomSyncAt);
}
