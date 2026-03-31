import type Database from "better-sqlite3";

import type { SyncableStudentGroupMember } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class StudentGroupMembersRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForGroup(courseId: string, studentGroupId: string, members: SyncableStudentGroupMember[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM student_group_members WHERE course_id = ? AND student_group_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO student_group_members (course_id, student_group_id, user_id, raw_json)
       VALUES (@courseId, @studentGroupId, @userId, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableStudentGroupMember[]) => {
      deleteStmt.run(courseId, studentGroupId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          studentGroupId: record.studentGroupId,
          userId: record.userId,
          rawJson: this.stringifyRaw(record),
        });
      }
    });
    transaction(members);
  }
}
