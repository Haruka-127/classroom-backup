import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { closeDatabase, openDatabase } from "../../src/storage/db.js";
import { createRepositories } from "../../src/storage/repositories/index.js";

describe("ArtifactBlobsRepository", () => {
  it("stores, deduplicates, and retrieves blob content", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "classroom-artifact-blob-"));
    const db = openDatabase(path.join(root, "backup.sqlite"));

    try {
      const repositories = createRepositories(db);
      const content = Buffer.from("same-content");
      const sha256 = createHash("sha256").update(content).digest("hex");

      const first = repositories.artifactBlobs.upsert(content, sha256, content.byteLength);
      const second = repositories.artifactBlobs.upsert(content, sha256, content.byteLength);

      expect(first.blobId).toBe(sha256);
      expect(second.blobId).toBe(sha256);
      expect(repositories.artifactBlobs.exists(sha256)).toBe(true);
      expect(repositories.artifactBlobs.get(sha256)?.content.toString("utf8")).toBe("same-content");

      const count = (db.prepare(`SELECT COUNT(*) AS count FROM artifact_blobs`).get() as { count: number }).count;
      expect(count).toBe(1);
    } finally {
      closeDatabase(db);
    }
  });
});
