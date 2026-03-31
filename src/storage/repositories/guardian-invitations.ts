import type Database from "better-sqlite3";

import type { SyncableGuardianInvitation } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class GuardianInvitationsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForStudent(studentId: string, invitations: SyncableGuardianInvitation[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM guardian_invitations WHERE student_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO guardian_invitations (student_id, invitation_id, invited_email_address, state, raw_json)
       VALUES (@studentId, @invitationId, @invitedEmailAddress, @state, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableGuardianInvitation[]) => {
      deleteStmt.run(studentId);
      for (const record of records) {
        insertStmt.run({
          studentId: record.studentId,
          invitationId: record.invitationId,
          invitedEmailAddress: record.invitedEmailAddress ?? null,
          state: record.state ?? null,
          rawJson: this.stringifyRaw(record),
        });
      }
    });
    transaction(invitations);
  }
}
