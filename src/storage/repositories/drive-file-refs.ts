import type Database from "better-sqlite3";

import type { DriveReferenceRecord } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class DriveFileRefsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForCourse(courseId: string, refs: DriveReferenceRecord[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM drive_file_refs WHERE course_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO drive_file_refs (
         course_id, announcement_id, course_work_id, course_work_material_id, submission_id, source_type,
         attachment_type, drive_file_id, template_drive_file_id, submission_drive_file_id,
         share_mode, materialization_state, link_url, raw_json
       ) VALUES (
         @courseId, @announcementId, @courseWorkId, @courseWorkMaterialId, @submissionId, @sourceType,
         @attachmentType, @driveFileId, @templateDriveFileId, @submissionDriveFileId,
         @shareMode, @materializationState, @linkUrl, @rawJson
       )`,
    );
    const transaction = this.db.transaction((records: DriveReferenceRecord[]) => {
      deleteStmt.run(courseId);
      for (const record of records) {
        insertStmt.run({
          courseId: record.courseId,
          announcementId: record.announcementId ?? null,
          courseWorkId: record.courseWorkId ?? null,
          courseWorkMaterialId: record.courseWorkMaterialId ?? null,
          submissionId: record.submissionId ?? null,
          sourceType: record.sourceType,
          attachmentType: record.attachmentType,
          driveFileId: record.driveFileId ?? null,
          templateDriveFileId: record.templateDriveFileId ?? null,
          submissionDriveFileId: record.submissionDriveFileId ?? null,
          shareMode: record.shareMode ?? null,
          materializationState: record.materializationState,
          linkUrl: record.linkUrl ?? null,
          rawJson: this.stringify(record),
        });
      }
    });
    transaction(refs);
  }

  listReadyDriveFileIds(): string[] {
    const rows = this.db
      .prepare(`SELECT DISTINCT drive_file_id FROM drive_file_refs WHERE drive_file_id IS NOT NULL AND materialization_state = 'ready'`)
      .all() as Array<{ drive_file_id: string }>;

    return rows.map((row) => row.drive_file_id);
  }

  listPendingMaterializationRefs(): Array<{ courseId: string; templateDriveFileId: string | null }> {
    return this.db
      .prepare(
        `SELECT DISTINCT course_id AS courseId, template_drive_file_id AS templateDriveFileId
         FROM drive_file_refs WHERE materialization_state = 'pending_materialization'`,
      )
      .all() as Array<{ courseId: string; templateDriveFileId: string | null }>;
  }
}
