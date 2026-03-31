import type Database from "better-sqlite3";

import type { SyncableStudent } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class StudentsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, students: SyncableStudent[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM students WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO students (course_id, user_id, profile_name, profile_photo_url, raw_json)
       VALUES (@courseId, @userId, @profileName, @profilePhotoUrl, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableStudent[]) => {
      deleteStmt.run(courseId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          userId: record.userId,
          profileName: record.profileName ?? null,
          profilePhotoUrl: record.profilePhotoUrl ?? null,
          rawJson: this.stringifyRaw(record),
        });
      }
    });
    transaction(students);
  }
}
