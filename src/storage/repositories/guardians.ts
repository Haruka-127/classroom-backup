import type Database from "better-sqlite3";

import type { SyncableGuardian } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class GuardiansRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForStudent(studentId: string, guardians: SyncableGuardian[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM guardians WHERE student_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO guardians (student_id, guardian_id, guardian_name, invited_email_address, raw_json)
       VALUES (@studentId, @guardianId, @guardianName, @invitedEmailAddress, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableGuardian[]) => {
      deleteStmt.run(studentId);
      for (const record of records) {
        insertStmt.run({
          studentId: record.studentId,
          guardianId: record.guardianId,
          guardianName: record.guardianName ?? null,
          invitedEmailAddress: record.invitedEmailAddress ?? null,
          rawJson: this.stringifyRaw(record),
        });
      }
    });
    transaction(guardians);
  }
}
