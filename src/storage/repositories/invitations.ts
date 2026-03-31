import type Database from "better-sqlite3";

import type { SyncableInvitation } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class InvitationsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceAll(invitations: SyncableInvitation[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM invitations`);
    const insertStmt = this.db.prepare(
      `INSERT INTO invitations (invitation_id, course_id, user_id, role, raw_json)
       VALUES (@invitationId, @courseId, @userId, @role, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableInvitation[]) => {
      deleteStmt.run();
      for (const record of records) {
        insertStmt.run({
          invitationId: record.invitationId,
          courseId: record.courseId ?? null,
          userId: record.userId ?? null,
          role: record.role ?? null,
          rawJson: this.stringifyRaw(record),
        });
      }
    });
    transaction(invitations);
  }
}
