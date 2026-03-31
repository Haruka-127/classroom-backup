import type Database from "better-sqlite3";

import type { SyncableTeacher } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class TeachersRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, teachers: SyncableTeacher[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM teachers WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO teachers (course_id, user_id, profile_name, profile_photo_url, raw_json)
       VALUES (@courseId, @userId, @profileName, @profilePhotoUrl, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableTeacher[]) => {
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
    transaction(teachers);
  }
}
