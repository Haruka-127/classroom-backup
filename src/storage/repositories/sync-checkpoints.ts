import type Database from "better-sqlite3";

import type { SyncCheckpoint } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class SyncCheckpointsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  load(accountKey: string): SyncCheckpoint | null {
    return (this.db
      .prepare(
        `SELECT account_key AS accountKey, committed_start_page_token AS committedStartPageToken,
                last_successful_run_id AS lastSuccessfulRunId, last_classroom_sync_at AS lastClassroomSyncAt
         FROM sync_checkpoints WHERE account_key = ?`,
      )
      .get(accountKey) as SyncCheckpoint | undefined) ?? null;
  }

  commit(accountKey: string, startPageToken: string | null, runId: string, classroomSyncAt: string): void {
    this.db
      .prepare(
        `INSERT INTO sync_checkpoints (
           account_key, committed_start_page_token, last_successful_run_id, last_classroom_sync_at, updated_at
         ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(account_key) DO UPDATE SET
           committed_start_page_token=excluded.committed_start_page_token,
           last_successful_run_id=excluded.last_successful_run_id,
           last_classroom_sync_at=excluded.last_classroom_sync_at,
           updated_at=CURRENT_TIMESTAMP`,
      )
      .run(accountKey, startPageToken, runId, classroomSyncAt);
  }
}
