import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveAppPaths } from "../../src/config/app-paths.js";
import type { CourseBundle } from "../../src/lib/google/classroom-client.js";
import type { ClassroomService } from "../../src/lib/google/classroom-client.js";
import type { DriveService } from "../../src/lib/google/drive-client.js";
import { runFullSync } from "../../src/sync/full-sync.js";

class FakeClassroomService implements ClassroomService {
  constructor(private readonly bundles: CourseBundle[]) {}

  async listCourses() {
    return this.bundles.map((bundle) => bundle.course);
  }

  async listTopics(courseId: string) {
    return this.bundles.find((bundle) => bundle.course.id === courseId)?.topics ?? [];
  }

  async listAnnouncements(courseId: string) {
    return this.bundles.find((bundle) => bundle.course.id === courseId)?.announcements ?? [];
  }

  async listCourseWork(courseId: string) {
    return this.bundles.find((bundle) => bundle.course.id === courseId)?.courseWork ?? [];
  }

  async listCourseWorkMaterials(courseId: string) {
    return this.bundles.find((bundle) => bundle.course.id === courseId)?.courseWorkMaterials ?? [];
  }

  async listStudentSubmissions(courseId: string) {
    return this.bundles.find((bundle) => bundle.course.id === courseId)?.studentSubmissions ?? [];
  }

  async fetchCourseBundles() {
    return this.bundles;
  }
}

class FakeDriveService implements DriveService {
  async getStartPageToken() {
    return "start-token-1";
  }

  async listChanges() {
    return [];
  }

  async getFile(fileId: string) {
    return {
      driveFileId: fileId,
      name: "worksheet.pdf",
      mimeType: "application/pdf",
      md5Checksum: "abc123",
      modifiedTime: "2026-01-01T00:00:00.000Z",
      size: "12",
      version: "1",
      trashed: false,
      webViewLink: null,
      exportLinks: null,
    };
  }

  async listComments(fileId: string) {
    return [
      {
        driveFileId: fileId,
        commentId: "comment-1",
        content: "Looks good",
        authorDisplayName: "Teacher",
        repliesJson: [],
      },
    ];
  }

  async downloadBlob() {
    return Buffer.from("pdf-content");
  }

  async exportFile() {
    return Buffer.from("export-content");
  }

  async getAbout() {
    return { email: "student@example.com", displayName: "Student", permissionId: "perm-1" };
  }
}

describe("runFullSync", () => {
  it("writes manifest and status report for a full sync", async () => {
    const outDir = path.join(os.tmpdir(), `classroom-backup-sync-${Date.now()}`);
    const paths = resolveAppPaths(outDir);
    await mkdir(paths.configRoot, { recursive: true });
    await mkdir(outDir, { recursive: true });
    const oauthClientPath = paths.oauthClientPath;
    await mkdir(path.dirname(oauthClientPath), { recursive: true });
    await readFile;
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        oauthClientPath,
        JSON.stringify({ clientId: "test-client", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] }),
      ),
    );

    const classroom = new FakeClassroomService([
      {
        course: { id: "course-1", name: "Math", courseState: "ACTIVE" },
        topics: [{ courseId: "course-1", topicId: "topic-1", name: "Week 1" }],
        announcements: [{ courseId: "course-1", announcementId: "ann-1", text: "Hello" }],
        courseWork: [
          {
            courseId: "course-1",
            courseWorkId: "cw-1",
            title: "Assignment",
            materials: [
              {
                driveFile: {
                  driveFile: { id: "drive-1", alternateLink: "https://drive.google.com/file/d/drive-1" },
                  shareMode: "VIEW",
                },
              },
            ],
          },
        ],
        courseWorkMaterials: [],
        studentSubmissions: [],
      },
    ]);

    const result = await runFullSync({
      out: outDir,
      services: { classroom, drive: new FakeDriveService() },
      now: () => "2026-03-31T00:00:00.000Z",
    });

    expect(result.status).toBe("success");

    const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8")) as { artifacts: Array<{ relativePath: string }> };
    expect(manifest.artifacts).toHaveLength(1);
    expect(manifest.artifacts[0]?.relativePath).toContain("drive-1");

    const statusReport = JSON.parse(await readFile(paths.statusReportPath, "utf8")) as { counts: Record<string, number> };
    expect(statusReport.counts.success).toBeGreaterThan(0);
  });
});
