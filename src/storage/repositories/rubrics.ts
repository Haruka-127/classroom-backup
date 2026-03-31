import type Database from "better-sqlite3";

import type { SyncableRubric } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class RubricsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourseWork(courseId: string, courseWorkId: string, rubrics: SyncableRubric[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM rubrics WHERE course_id = ? AND course_work_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO rubrics (course_id, course_work_id, rubric_id, title, raw_json)
       VALUES (@courseId, @courseWorkId, @rubricId, @title, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableRubric[]) => {
      deleteStmt.run(courseId, courseWorkId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          courseWorkId: record.courseWorkId,
          rubricId: record.rubricId,
          title: record.title ?? null,
          rawJson: this.stringifyRaw(record),
        });
      }
    });
    transaction(rubrics);
  }
}
