import type Database from "better-sqlite3";

import type { SyncableCourseGradingPeriodSettings } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class CourseGradingPeriodSettingsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, settings: SyncableCourseGradingPeriodSettings | null): void {
    this.db.prepare(`DELETE FROM course_grading_period_settings WHERE course_id = ?`).run(courseId);

    if (!settings) {
      return;
    }

    this.db
      .prepare(
        `INSERT INTO course_grading_period_settings (course_id, raw_json, updated_at)
         VALUES (@courseId, @rawJson, CURRENT_TIMESTAMP)`,
      )
      .run({
        courseId: settings.courseId,
        rawJson: this.stringifyRaw(settings),
      });
  }
}
