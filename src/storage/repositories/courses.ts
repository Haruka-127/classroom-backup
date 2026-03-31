import type Database from "better-sqlite3";

import type { CourseVisibilityStatus, SyncableCourse } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class CoursesRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  upsert(course: SyncableCourse, runId: string, visibilityStatus: CourseVisibilityStatus = "visible"): void {
    this.db
      .prepare(
        `INSERT INTO courses (
          course_id, name, section, description_heading, description, room, owner_id,
          course_state, alternate_link, creation_time, update_time, raw_json,
          last_seen_run_id, visibility_status, updated_at
        ) VALUES (
          @courseId, @name, @section, @descriptionHeading, @description, @room, @ownerId,
          @courseState, @alternateLink, @creationTime, @updateTime, @rawJson,
          @lastSeenRunId, @visibilityStatus, CURRENT_TIMESTAMP
        )
        ON CONFLICT(course_id) DO UPDATE SET
          name=excluded.name,
          section=excluded.section,
          description_heading=excluded.description_heading,
          description=excluded.description,
          room=excluded.room,
          owner_id=excluded.owner_id,
          course_state=excluded.course_state,
          alternate_link=excluded.alternate_link,
          creation_time=excluded.creation_time,
          update_time=excluded.update_time,
          raw_json=excluded.raw_json,
          last_seen_run_id=excluded.last_seen_run_id,
          visibility_status=excluded.visibility_status,
          updated_at=CURRENT_TIMESTAMP`,
      )
      .run({
        courseId: course.id,
        name: course.name ?? null,
        section: course.section ?? null,
        descriptionHeading: course.descriptionHeading ?? null,
        description: course.description ?? null,
        room: course.room ?? null,
        ownerId: course.ownerId ?? null,
        courseState: course.courseState ?? null,
        alternateLink: course.alternateLink ?? null,
        creationTime: course.creationTime ?? null,
        updateTime: course.updateTime ?? null,
        rawJson: this.stringifyRaw(course),
        lastSeenRunId: runId,
        visibilityStatus,
      });
  }

  listIds(): string[] {
    return (this.db.prepare(`SELECT course_id FROM courses`).all() as Array<{ course_id: string }>).map((row) => row.course_id);
  }

  markMissing(courseId: string, visibilityStatus: Exclude<CourseVisibilityStatus, "visible">): void {
    this.db.prepare(`UPDATE courses SET visibility_status = ?, updated_at = CURRENT_TIMESTAMP WHERE course_id = ?`).run(visibilityStatus, courseId);
  }
}
