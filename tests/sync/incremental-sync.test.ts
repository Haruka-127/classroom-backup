import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { resolveAppPaths } from "../../src/config/app-paths.js";
import { runFullSync } from "../../src/sync/full-sync.js";
import { runIncrementalSync } from "../../src/sync/incremental-sync.js";
import type { ClassroomService, CourseBundle } from "../../src/lib/google/classroom-client.js";
import type { DriveService } from "../../src/lib/google/drive-client.js";

class ClassroomFixtureService implements ClassroomService {
  constructor(private readonly bundles: CourseBundle[]) {}
  async listCourses() { return this.bundles.map((bundle) => bundle.course); }
  async listTopics(courseId: string) { return this.bundles.find((bundle) => bundle.course.id === courseId)?.topics ?? []; }
  async listAnnouncements(courseId: string) { return this.bundles.find((bundle) => bundle.course.id === courseId)?.announcements ?? []; }
  async listCourseWork(courseId: string) { return this.bundles.find((bundle) => bundle.course.id === courseId)?.courseWork ?? []; }
  async listCourseWorkMaterials(courseId: string) { return this.bundles.find((bundle) => bundle.course.id === courseId)?.courseWorkMaterials ?? []; }
  async listStudentSubmissions(courseId: string) { return this.bundles.find((bundle) => bundle.course.id === courseId)?.studentSubmissions ?? []; }
  async fetchCourseBundles() { return this.bundles; }
}

class DriveFixtureService implements DriveService {
  async getStartPageToken() { return "token-2"; }
  async listChanges() { return [{ fileId: "drive-1", removed: false, time: "2026-03-31T00:00:00.000Z" }]; }
  async getFile(fileId: string) {
    return {
      driveFileId: fileId,
      name: "worksheet.pdf",
      mimeType: "application/pdf",
      md5Checksum: null,
      size: "10",
      modifiedTime: "2026-03-31T00:00:00.000Z",
      version: "2",
      trashed: false,
      webViewLink: null,
      exportLinks: null,
    };
  }
  async listComments(fileId: string) { return [{ driveFileId: fileId, commentId: "c1", repliesJson: [] }]; }
  async downloadBlob() { return Buffer.from("content"); }
  async exportFile() { return Buffer.from("export"); }
  async getAbout() { return { email: "student@example.com", displayName: "Student", permissionId: "perm-1" }; }
}

describe("runIncrementalSync", () => {
  it("keeps local data and updates outputs on rescan", async () => {
    const outDir = path.join(os.tmpdir(), `classroom-backup-incremental-${Date.now()}`);
    const paths = resolveAppPaths(outDir);
    await mkdir(path.dirname(paths.oauthClientPath), { recursive: true });
    await writeFile(paths.oauthClientPath, JSON.stringify({ clientId: "test-client", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] }));

    const bundles: CourseBundle[] = [
      {
        course: { id: "course-1", name: "Math", courseState: "ACTIVE" },
        topics: [],
        announcements: [],
        courseWork: [
          {
            courseId: "course-1",
            courseWorkId: "cw-1",
            title: "Assignment",
            materials: [
              { driveFile: { driveFile: { id: "drive-1", alternateLink: "https://drive.google.com/file/d/drive-1" }, shareMode: "VIEW" } },
            ],
          },
        ],
        courseWorkMaterials: [],
        studentSubmissions: [],
      },
    ];

    const logger = { log: vi.fn() };

    await runFullSync({ out: outDir, services: { classroom: new ClassroomFixtureService(bundles), drive: new DriveFixtureService() } });
    const result = await runIncrementalSync({
      out: outDir,
      services: { classroom: new ClassroomFixtureService(bundles), drive: new DriveFixtureService() },
      logger,
    });

    expect(result.status).toBe("success");
    const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8")) as { artifacts: unknown[] };
    expect(manifest.artifacts.length).toBeGreaterThan(0);
    expect(logger.log).toHaveBeenCalledWith("Starting incremental sync");
    expect(logger.log).toHaveBeenCalledWith("Re-fetched 1 changed Drive files since last committed checkpoint.");
  });
});
