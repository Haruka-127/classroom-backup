import type Database from "better-sqlite3";

import type { ArtifactBlobRecord } from "../../domain/classroom-types.js";
import { BaseRepository } from "./base.js";

export class ArtifactBlobsRepository extends BaseRepository {
  constructor(db: Database.Database) {
    super(db);
  }

  upsert(content: Buffer, sha256: string, sizeBytes: number): ArtifactBlobRecord {
    const blobId = sha256;
    this.db
      .prepare(
        `INSERT INTO artifact_blobs (blob_id, sha256, size_bytes, content)
         VALUES (@blobId, @sha256, @sizeBytes, @content)
         ON CONFLICT(blob_id) DO NOTHING`,
      )
      .run({ blobId, sha256, sizeBytes, content });

    return this.get(blobId)!;
  }

  get(blobId: string): ArtifactBlobRecord | null {
    return (
      (this.db
        .prepare(
          `SELECT blob_id AS blobId, sha256, size_bytes AS sizeBytes, content
           FROM artifact_blobs WHERE blob_id = ?`,
        )
        .get(blobId) as ArtifactBlobRecord | undefined) ?? null
    );
  }

  exists(blobId: string): boolean {
    const row = this.db.prepare(`SELECT 1 FROM artifact_blobs WHERE blob_id = ?`).get(blobId) as { 1: number } | undefined;
    return Boolean(row);
  }
}
