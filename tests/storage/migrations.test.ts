import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { closeDatabase, openDatabase } from "../../src/storage/db.js";

describe("database migrations", () => {
  it("initializes the single-file backup schema", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "classroom-migration-test-"));
    const databasePath = path.join(root, "backup.sqlite");

    const db = openDatabase(databasePath);
    try {
      const migrationVersions = db.prepare(`SELECT version FROM schema_migrations ORDER BY version ASC`).all() as Array<{ version: number }>;
      const artifactBlobs = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artifact_blobs'`).get() as { name: string } | undefined;
      const syncStatusRecords = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_status_records'`).get() as
        | { name: string }
        | undefined;
      const artifactColumns = db.prepare(`PRAGMA table_info(drive_file_artifacts)`).all() as Array<{ name: string }>;

      expect(migrationVersions.map((item) => item.version)).toEqual([1]);
      expect(artifactBlobs?.name).toBe("artifact_blobs");
      expect(syncStatusRecords?.name).toBe("sync_status_records");
      expect(artifactColumns.map((column) => column.name)).toEqual(
        expect.arrayContaining(["artifact_id", "download_name", "blob_id", "checksum_value"]),
      );
    } finally {
      closeDatabase(db);
    }
  });
});
