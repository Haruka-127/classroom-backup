import type Database from "better-sqlite3";

import type { ManifestArtifactEntry } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export interface VerifiableArtifactRecord extends ManifestArtifactEntry {
  blobContent: Buffer | null;
}

export class DriveFileArtifactsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  upsert(entry: Omit<ManifestArtifactEntry, "artifactId">): ManifestArtifactEntry {
    this.db
      .prepare(
        `INSERT INTO drive_file_artifacts (
           drive_file_id, artifact_kind, output_mime_type, download_name, status,
           blob_id, size_bytes, checksum_type, checksum_value, source_modified_time, updated_at
          ) VALUES (
           @driveFileId, @artifactKind, @outputMimeType, @downloadName, @status,
           @blobId, @sizeBytes, @checksumType, @checksumValue, @sourceModifiedTime, CURRENT_TIMESTAMP
          )
          ON CONFLICT(drive_file_id, artifact_kind, output_mime_type) DO UPDATE SET
            download_name=excluded.download_name,
            status=excluded.status,
            blob_id=excluded.blob_id,
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
        downloadName: entry.downloadName,
        status: entry.status,
        blobId: entry.blobId ?? null,
        sizeBytes: entry.sizeBytes ?? null,
        checksumType: entry.checksumType ?? null,
        checksumValue: entry.checksumValue ?? null,
        sourceModifiedTime: entry.sourceModifiedTime ?? null,
      });

    return this.getByKey(entry.driveFileId, entry.artifactKind, entry.outputMimeType ?? "")!;
  }

  listAll(): ManifestArtifactEntry[] {
    return this.db
      .prepare(
        `SELECT artifact_id AS artifactId, drive_file_id AS driveFileId, artifact_kind AS artifactKind,
                output_mime_type AS outputMimeType, download_name AS downloadName, status, blob_id AS blobId,
                size_bytes AS sizeBytes, checksum_type AS checksumType,
                checksum_value AS checksumValue, source_modified_time AS sourceModifiedTime
         FROM drive_file_artifacts ORDER BY drive_file_id, artifact_kind, download_name`,
      )
      .all() as ManifestArtifactEntry[];
  }

  listByDriveFileId(driveFileId: string): ManifestArtifactEntry[] {
    return this.db
      .prepare(
        `SELECT artifact_id AS artifactId, drive_file_id AS driveFileId, artifact_kind AS artifactKind,
                output_mime_type AS outputMimeType, download_name AS downloadName, status, blob_id AS blobId,
                size_bytes AS sizeBytes, checksum_type AS checksumType,
                checksum_value AS checksumValue, source_modified_time AS sourceModifiedTime
         FROM drive_file_artifacts
         WHERE drive_file_id = ?
         ORDER BY artifact_kind ASC, download_name ASC`,
      )
      .all(driveFileId) as ManifestArtifactEntry[];
  }

  listSavedWithBlobs(): VerifiableArtifactRecord[] {
    return this.db
      .prepare(
        `SELECT a.artifact_id AS artifactId, a.drive_file_id AS driveFileId, a.artifact_kind AS artifactKind,
                a.output_mime_type AS outputMimeType, a.download_name AS downloadName, a.status, a.blob_id AS blobId,
                a.size_bytes AS sizeBytes, a.checksum_type AS checksumType, a.checksum_value AS checksumValue,
                a.source_modified_time AS sourceModifiedTime, b.content AS blobContent
         FROM drive_file_artifacts a
         LEFT JOIN artifact_blobs b ON b.blob_id = a.blob_id
         WHERE a.status = 'saved'
         ORDER BY a.artifact_id ASC`,
      )
      .all() as VerifiableArtifactRecord[];
  }

  getArtifactContent(artifactId: number): { content: Buffer; outputMimeType: string | null; downloadName: string } | null {
    return (
      (this.db
        .prepare(
          `SELECT b.content AS content, a.output_mime_type AS outputMimeType, a.download_name AS downloadName
           FROM drive_file_artifacts a
           JOIN artifact_blobs b ON b.blob_id = a.blob_id
           WHERE a.artifact_id = ? AND a.status = 'saved'`,
        )
        .get(artifactId) as { content: Buffer; outputMimeType: string; downloadName: string } | undefined) ?? null
    );
  }

  private getByKey(driveFileId: string, artifactKind: "blob" | "export", outputMimeType: string): ManifestArtifactEntry | null {
    return (
      (this.db
        .prepare(
          `SELECT artifact_id AS artifactId, drive_file_id AS driveFileId, artifact_kind AS artifactKind,
                  output_mime_type AS outputMimeType, download_name AS downloadName, status, blob_id AS blobId,
                  size_bytes AS sizeBytes, checksum_type AS checksumType,
                  checksum_value AS checksumValue, source_modified_time AS sourceModifiedTime
           FROM drive_file_artifacts
           WHERE drive_file_id = ? AND artifact_kind = ? AND output_mime_type = ?`,
        )
        .get(driveFileId, artifactKind, outputMimeType) as ManifestArtifactEntry | undefined) ?? null
    );
  }
}
