import type Database from "better-sqlite3";

import type { DriveCommentRecord } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class DriveCommentsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  replaceForFile(driveFileId: string, comments: DriveCommentRecord[]): void {
    const deleteStmt = this.db.prepare(`DELETE FROM drive_comments WHERE drive_file_id = ?`);
    const insertStmt = this.db.prepare(
      `INSERT INTO drive_comments (
         drive_file_id, comment_id, content, author_display_name, created_time,
         modified_time, resolved, deleted, quoted_file_content_value, replies_json, raw_json
       ) VALUES (
         @driveFileId, @commentId, @content, @authorDisplayName, @createdTime,
         @modifiedTime, @resolved, @deleted, @quotedFileContentValue, @repliesJson, @rawJson
       )`,
    );
    const transaction = this.db.transaction((records: DriveCommentRecord[]) => {
      deleteStmt.run(driveFileId);
      for (const record of records) {
        insertStmt.run({
          driveFileId: record.driveFileId,
          commentId: record.commentId,
          content: record.content ?? null,
          authorDisplayName: record.authorDisplayName ?? null,
          createdTime: record.createdTime ?? null,
          modifiedTime: record.modifiedTime ?? null,
          resolved: record.resolved === null || record.resolved === undefined ? null : Number(record.resolved),
          deleted: record.deleted === null || record.deleted === undefined ? null : Number(record.deleted),
          quotedFileContentValue: record.quotedFileContentValue ?? null,
          repliesJson: this.stringify(record.repliesJson),
          rawJson: this.stringify(record),
        });
      }
    });
    transaction(comments);
  }
}
