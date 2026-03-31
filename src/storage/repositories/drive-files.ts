import type Database from "better-sqlite3";

import type { DriveFileRecord } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class DriveFilesRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  upsert(file: DriveFileRecord): void {
    this.db
      .prepare(
        `INSERT INTO drive_files (
           drive_file_id, name, mime_type, md5_checksum, size, modified_time,
           version, trashed, web_view_link, export_links_json, raw_json, updated_at
         ) VALUES (
           @driveFileId, @name, @mimeType, @md5Checksum, @size, @modifiedTime,
           @version, @trashed, @webViewLink, @exportLinksJson, @rawJson, CURRENT_TIMESTAMP
         )
         ON CONFLICT(drive_file_id) DO UPDATE SET
           name=excluded.name,
           mime_type=excluded.mime_type,
           md5_checksum=excluded.md5_checksum,
           size=excluded.size,
           modified_time=excluded.modified_time,
           version=excluded.version,
           trashed=excluded.trashed,
           web_view_link=excluded.web_view_link,
           export_links_json=excluded.export_links_json,
           raw_json=excluded.raw_json,
           updated_at=CURRENT_TIMESTAMP`,
      )
      .run({
        driveFileId: file.driveFileId,
        name: file.name ?? null,
        mimeType: file.mimeType ?? null,
        md5Checksum: file.md5Checksum ?? null,
        size: file.size ?? null,
        modifiedTime: file.modifiedTime ?? null,
        version: file.version ?? null,
        trashed: file.trashed === null || file.trashed === undefined ? null : Number(file.trashed),
        webViewLink: file.webViewLink ?? null,
        exportLinksJson: this.stringify(file.exportLinks ?? null),
        rawJson: this.stringify(file),
      });
  }
}
