import type Database from "better-sqlite3";

import type { SyncFailureRecord } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class FailuresRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  insert(failure: SyncFailureRecord): void {
    this.db
      .prepare(
        `INSERT INTO failures (
           run_id, scope, entity_type, entity_id, status, reason_code, message, details_json
         ) VALUES (
           @runId, @scope, @entityType, @entityId, @status, @reasonCode, @message, @detailsJson
         )`,
      )
      .run({
        ...failure,
        entityId: failure.entityId ?? null,
        detailsJson: failure.detailsJson === undefined ? null : this.stringify(failure.detailsJson),
      });
  }

  listByRun(runId: string): SyncFailureRecord[] {
    return this.db
      .prepare(
        `SELECT run_id AS runId, scope, entity_type AS entityType, entity_id AS entityId,
                status, reason_code AS reasonCode, message, details_json AS detailsJson
         FROM failures WHERE run_id = ? ORDER BY failure_id ASC`,
      )
      .all(runId) as SyncFailureRecord[];
  }
}
