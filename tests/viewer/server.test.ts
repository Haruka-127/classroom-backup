import { mkdtemp, mkdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, closeDatabase } from "../../src/storage/db.js";
import { createRepositories } from "../../src/storage/repositories/index.js";
import { startViewerServer } from "../../src/viewer/server.js";

async function createServerFixture() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "classroom-viewer-server-"));
  const databasePath = path.join(outDir, "backup.sqlite");
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), "classroom-viewer-static-"));
  await writeFile(path.join(staticRoot, "index.html"), "<html><body>viewer</body></html>");
  await mkdir(path.join(staticRoot, "assets"), { recursive: true });
  await writeFile(path.join(staticRoot, "assets", "app.js"), "console.log('viewer');");

  const db = openDatabase(databasePath);
  const repositories = createRepositories(db);
  const content = Buffer.from("pdf");
  const blobId = createHash("sha256").update(content).digest("hex");
  repositories.artifactBlobs.upsert(content, blobId, content.byteLength);
  repositories.courses.upsert({ id: "course-1", name: "Math" }, "run-1");
  repositories.driveFileRefs.replaceForCourse("course-1", [
    {
      courseId: "course-1",
      courseWorkId: null,
      courseWorkMaterialId: null,
      submissionId: null,
      sourceType: "course_material",
      attachmentType: "drive_file",
      driveFileId: "drive-1",
      templateDriveFileId: null,
      submissionDriveFileId: null,
      shareMode: null,
      materializationState: "ready",
      linkUrl: null,
    },
  ]);
  repositories.driveFiles.upsert({ driveFileId: "drive-1", name: "Sheet.pdf", mimeType: "application/pdf" });
  repositories.driveFileArtifacts.upsert({
    driveFileId: "drive-1",
    artifactKind: "blob",
    outputMimeType: "application/pdf",
    downloadName: "課題.pdf",
    status: "saved",
    blobId,
    sizeBytes: content.byteLength,
    checksumType: "sha256",
    checksumValue: blobId,
  });
  closeDatabase(db);

  return { outDir, databasePath, staticRoot };
}

const startedServers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (startedServers.length > 0) {
    await startedServers.pop()?.close();
  }
});

describe("startViewerServer", () => {
  it("serves API, static files, and artifacts without mutating the database", async () => {
    const fixture = await createServerFixture();
    const before = await stat(fixture.databasePath);
    const server = await startViewerServer({ outDir: fixture.outDir, port: 0, staticRoot: fixture.staticRoot });
    startedServers.push(server);

    const courseResponse = await fetch(`${server.origin}/api/courses`);
    expect(courseResponse.status).toBe(200);
    expect(((await courseResponse.json()) as { courses: Array<{ courseId: string }> }).courses[0]?.courseId).toBe("course-1");

    const fileResponse = await fetch(`${server.origin}/api/files/drive-1`);
    expect(fileResponse.status).toBe(200);

    const filePayload = (await fileResponse.json()) as { artifacts: Array<{ artifactId: number }> };
    const artifactResponse = await fetch(`${server.origin}/api/artifacts/${filePayload.artifacts[0]?.artifactId}`);
    expect(artifactResponse.status).toBe(200);
    expect(artifactResponse.headers.get("content-disposition")).toContain("filename*=UTF-8''%E8%AA%B2%E9%A1%8C.pdf");
    expect(await artifactResponse.text()).toBe("pdf");

    const missingArtifactResponse = await fetch(`${server.origin}/api/artifacts/not-a-number`);
    expect(missingArtifactResponse.status).toBe(404);

    const spaResponse = await fetch(`${server.origin}/courses/course-1`);
    expect(spaResponse.status).toBe(200);
    expect(await spaResponse.text()).toContain("viewer");

    const after = await stat(fixture.databasePath);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(server.origin).toContain("127.0.0.1");
  });
});
