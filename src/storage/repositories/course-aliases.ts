import type Database from "better-sqlite3";

import type { SyncableCourseAlias } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class CourseAliasesRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, aliases: SyncableCourseAlias[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM course_aliases WHERE course_id = ?`);
    const insertStmt = this.db.prepare(`INSERT INTO course_aliases (course_id, alias, raw_json) VALUES (@courseId, @alias, @rawJson)`);
    const transaction = this.db.transaction((records: SyncableCourseAlias[]) => {
      deleteStmt.run(courseId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          alias: record.alias,
          rawJson: this.stringifyRaw(record),
        });
      }
    });
    transaction(aliases);
  }
}
