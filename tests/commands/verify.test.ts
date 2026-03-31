import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { runVerifyCommand } from "../../src/commands/verify.js";
import { closeDatabase, openDatabase } from "../../src/storage/db.js";
import { createRepositories } from "../../src/storage/repositories/index.js";

async function createVerifyFixture(): Promise<{ outDir: string; databasePath: string }> {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "classroom-verify-"));
  const databasePath = path.join(outDir, "backup.sqlite");
  const db = openDatabase(databasePath);

  try {
    const repositories = createRepositories(db);
    const content = Buffer.from("artifact-content");
    const sha256 = createHash("sha256").update(content).digest("hex");
    repositories.artifactBlobs.upsert(content, sha256, content.byteLength);
    repositories.driveFileArtifacts.upsert({
      driveFileId: "drive-1",
      artifactKind: "blob",
      outputMimeType: "application/pdf",
      downloadName: "file.pdf",
      status: "saved",
      blobId: sha256,
      sizeBytes: content.byteLength,
      checksumType: "sha256",
      checksumValue: sha256,
    });
  } finally {
    closeDatabase(db);
  }

  return { outDir, databasePath };
}

describe("runVerifyCommand", () => {
  it("succeeds when saved artifacts match stored blobs", async () => {
    const fixture = await createVerifyFixture();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await expect(runVerifyCommand({ out: fixture.outDir })).resolves.toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith("Verify succeeded. Checked 1 saved artifacts in backup.sqlite.");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("fails when blob content is missing", async () => {
    const fixture = await createVerifyFixture();
    const db = openDatabase(fixture.databasePath);
    db.prepare(`DELETE FROM artifact_blobs`).run();
    closeDatabase(db);

    await expect(runVerifyCommand({ out: fixture.outDir })).rejects.toThrow(/missing blob content/);
  });

  it("fails when checksum does not match blob content", async () => {
    const fixture = await createVerifyFixture();
    const db = openDatabase(fixture.databasePath);
    db.prepare(`UPDATE drive_file_artifacts SET checksum_value = 'wrong'`).run();
    closeDatabase(db);

    await expect(runVerifyCommand({ out: fixture.outDir })).rejects.toThrow(/checksum mismatch/);
  });
});
