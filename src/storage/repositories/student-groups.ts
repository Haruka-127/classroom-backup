import type Database from "better-sqlite3";

import type { SyncableStudentGroup } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class StudentGroupsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, groups: SyncableStudentGroup[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM student_groups WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO student_groups (course_id, student_group_id, title, raw_json)
       VALUES (@courseId, @studentGroupId, @title, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableStudentGroup[]) => {
      deleteStmt.run(courseId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          studentGroupId: record.studentGroupId,
          title: record.title ?? null,
          rawJson: this.stringifyRaw(record),
        });
      }
    });
    transaction(groups);
  }
}
