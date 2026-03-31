import type Database from "better-sqlite3";

import type { ManifestArtifactEntry } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class DriveFileArtifactsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  upsert(entry: ManifestArtifactEntry): void {
    this.db
      .prepare(
        `INSERT INTO drive_file_artifacts (
           drive_file_id, artifact_kind, output_mime_type, relative_path, status,
           size_bytes, checksum_type, checksum_value, source_modified_time, updated_at
         ) VALUES (
           @driveFileId, @artifactKind, @outputMimeType, @relativePath, @status,
           @sizeBytes, @checksumType, @checksumValue, @sourceModifiedTime, CURRENT_TIMESTAMP
         )
         ON CONFLICT(drive_file_id, artifact_kind, output_mime_type, relative_path) DO UPDATE SET
           status=excluded.status,
           size_bytes=excluded.size_bytes,
           checksum_type=excluded.checksum_type,
           checksum_value=excluded.checksum_value,
           source_modified_time=excluded.source_modified_time,
           updated_at=CURRENT_TIMESTAMP`,
      )
      .run({
        driveFileId: entry.driveFileId,
        artifactKind: entry.artifactKind,
        outputMimeType: entry.outputMimeType ?? "",
        relativePath: entry.relativePath,
        status: entry.status,
        sizeBytes: entry.sizeBytes ?? null,
        checksumType: entry.checksumType ?? null,
        checksumValue: entry.checksumValue ?? null,
        sourceModifiedTime: entry.sourceModifiedTime ?? null,
      });
  }

  listAll(): ManifestArtifactEntry[] {
    return this.db
      .prepare(
        `SELECT drive_file_id AS driveFileId, artifact_kind AS artifactKind, output_mime_type AS outputMimeType,
                relative_path AS relativePath, status, size_bytes AS sizeBytes, checksum_type AS checksumType,
                checksum_value AS checksumValue, source_modified_time AS sourceModifiedTime
         FROM drive_file_artifacts ORDER BY drive_file_id, artifact_kind, relative_path`,
      )
      .all() as ManifestArtifactEntry[];
  }
}
