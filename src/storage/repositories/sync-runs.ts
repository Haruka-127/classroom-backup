import type Database from "better-sqlite3";

import type { SyncRunPhase, SyncRunStatus } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export interface SyncRunRecord {
  runId: string;
  accountKey: string;
  mode: "full" | "incremental";
  phase: SyncRunPhase;
  status: SyncRunStatus;
  driveStartPageTokenCandidate?: string | null;
  startedAt: string;
  completedAt?: string | null;
  summaryJson?: unknown;
}

export class SyncRunsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  upsert(record: SyncRunRecord): void {
    this.db
      .prepare(
        `INSERT INTO sync_runs (
           run_id, account_key, mode, phase, status, drive_start_page_token_candidate,
           started_at, completed_at, summary_json
         ) VALUES (
           @runId, @accountKey, @mode, @phase, @status, @driveStartPageTokenCandidate,
           @startedAt, @completedAt, @summaryJson
         )
         ON CONFLICT(run_id) DO UPDATE SET
           phase=excluded.phase,
           status=excluded.status,
           drive_start_page_token_candidate=excluded.drive_start_page_token_candidate,
           completed_at=excluded.completed_at,
           summary_json=excluded.summary_json`,
      )
      .run({
        ...record,
        driveStartPageTokenCandidate: record.driveStartPageTokenCandidate ?? null,
        completedAt: record.completedAt ?? null,
        summaryJson: record.summaryJson === undefined ? null : this.stringify(record.summaryJson),
      });
  }

  get(runId: string): SyncRunRecord | null {
    return (this.db
      .prepare(
        `SELECT run_id AS runId, account_key AS accountKey, mode, phase, status,
                drive_start_page_token_candidate AS driveStartPageTokenCandidate,
                started_at AS startedAt, completed_at AS completedAt,
                summary_json AS summaryJson
         FROM sync_runs WHERE run_id = ?`,
      )
      .get(runId) as SyncRunRecord | undefined) ?? null;
  }

  findPendingRun(accountKey: string, mode: "full" | "incremental"): SyncRunRecord | null {
    return (this.db
      .prepare(
        `SELECT run_id AS runId, account_key AS accountKey, mode, phase, status,
                drive_start_page_token_candidate AS driveStartPageTokenCandidate,
                started_at AS startedAt, completed_at AS completedAt,
                summary_json AS summaryJson
         FROM sync_runs
         WHERE account_key = ? AND mode = ? AND status IN ('running', 'partial')
         ORDER BY started_at DESC LIMIT 1`,
      )
      .get(accountKey, mode) as SyncRunRecord | undefined) ?? null;
  }
}
