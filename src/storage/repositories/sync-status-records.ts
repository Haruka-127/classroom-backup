import type Database from "better-sqlite3";

import type { StatusRecord } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class SyncStatusRecordsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  insert(record: StatusRecord): void {
    this.db
      .prepare(
        `INSERT INTO sync_status_records (run_id, scope, entity_type, entity_id, status, message)
         VALUES (@runId, @scope, @entityType, @entityId, @status, @message)`,
      )
      .run(record);
  }

  listByRun(runId: string): StatusRecord[] {
    return this.db
      .prepare(
        `SELECT run_id AS runId, scope, entity_type AS entityType, entity_id AS entityId, status, message
         FROM sync_status_records
         WHERE run_id = ?
         ORDER BY status_id ASC`,
      )
      .all(runId) as StatusRecord[];
  }
}
