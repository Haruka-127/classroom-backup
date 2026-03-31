import type Database from "better-sqlite3";

import type { SyncableStudentSubmission } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class StudentSubmissionsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, items: SyncableStudentSubmission[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM student_submissions WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO student_submissions (
         course_id, course_work_id, submission_id, user_id, state, late, course_work_type,
         associated_with_developer, creation_time, update_time, short_answer,
         multiple_choice_answer, assigned_grade, draft_grade, alternate_link, raw_json
       ) VALUES (
         @courseId, @courseWorkId, @submissionId, @userId, @state, @late, @courseWorkType,
         @associatedWithDeveloper, @creationTime, @updateTime, @shortAnswer,
         @multipleChoiceAnswer, @assignedGrade, @draftGrade, @alternateLink, @rawJson
       )`,
    );
    const transaction = this.db.transaction((records: SyncableStudentSubmission[]) => {
      deleteStmt.run(courseId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          courseWorkId: record.courseWorkId,
          submissionId: record.submissionId,
          userId: record.userId ?? null,
          state: record.state ?? null,
          late: record.late === null || record.late === undefined ? null : Number(record.late),
          courseWorkType: record.courseWorkType ?? null,
          associatedWithDeveloper:
            record.associatedWithDeveloper === null || record.associatedWithDeveloper === undefined
              ? null
              : Number(record.associatedWithDeveloper),
          creationTime: record.creationTime ?? null,
          updateTime: record.updateTime ?? null,
          shortAnswer: record.shortAnswerSubmission?.answer ?? null,
          multipleChoiceAnswer: record.multipleChoiceSubmission?.answer ?? null,
          assignedGrade: record.assignedGrade ?? null,
          draftGrade: record.draftGrade ?? null,
          alternateLink: record.alternateLink ?? null,
          rawJson: this.stringify(record),
        });
      }
    });
    transaction(items);
  }
}
