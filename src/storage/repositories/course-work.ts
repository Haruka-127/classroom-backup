import type Database from "better-sqlite3";

import type { SyncableCourseWork } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class CourseWorkRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, items: SyncableCourseWork[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM course_work WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO course_work (course_id, course_work_id, title, description, work_type, state, alternate_link, topic_id, update_time, raw_json)
       VALUES (@courseId, @courseWorkId, @title, @description, @workType, @state, @alternateLink, @topicId, @updateTime, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableCourseWork[]) => {
      deleteStmt.run(courseId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          courseWorkId: record.courseWorkId,
          title: record.title ?? null,
          description: record.description ?? null,
          workType: record.workType ?? null,
          state: record.state ?? null,
          alternateLink: record.alternateLink ?? null,
          topicId: record.topicId ?? null,
          updateTime: record.updateTime ?? null,
          rawJson: this.stringify(record),
        });
      }
    });
    transaction(items);
  }
}
