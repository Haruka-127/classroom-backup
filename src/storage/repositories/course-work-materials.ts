import type Database from "better-sqlite3";

import type { SyncableCourseWorkMaterial } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class CourseWorkMaterialsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, items: SyncableCourseWorkMaterial[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM course_work_materials WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO course_work_materials (course_id, course_work_material_id, title, description, state, alternate_link, topic_id, update_time, raw_json)
       VALUES (@courseId, @courseWorkMaterialId, @title, @description, @state, @alternateLink, @topicId, @updateTime, @rawJson)`,
    );
    const transaction = this.db.transaction((records: SyncableCourseWorkMaterial[]) => {
      deleteStmt.run(courseId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          courseWorkMaterialId: record.courseWorkMaterialId,
          title: record.title ?? null,
          description: record.description ?? null,
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
