import { access, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { resolveAppPaths } from "../../src/config/app-paths.js";
import { closeDatabase, openDatabase } from "../../src/storage/db.js";
import type { CourseBundle } from "../../src/lib/google/classroom-client.js";
import type { ClassroomService } from "../../src/lib/google/classroom-client.js";
import type { DriveService } from "../../src/lib/google/drive-client.js";
import { runFullSync } from "../../src/sync/full-sync.js";
import { ViewerReadModel } from "../../src/viewer/read-model.js";

class FakeClassroomService implements ClassroomService {
  constructor(private readonly bundles: CourseBundle[]) {}

  private getBundle(courseId: string) {
    return this.bundles.find((bundle) => bundle.course.id === courseId);
  }

  async listCourses() {
    return this.bundles.map((bundle) => bundle.course);
  }

  async getCourse(courseId: string) {
    return this.getBundle(courseId)?.course ?? { id: courseId };
  }

  async listCourseAliases(courseId: string) {
    return this.getBundle(courseId)?.aliases ?? [];
  }

  async getGradingPeriodSettings(courseId: string) {
    return this.getBundle(courseId)?.gradingPeriodSettings ?? { courseId, rawJson: {} };
  }

  async listTopics(courseId: string) {
    return this.getBundle(courseId)?.topics ?? [];
  }

  async getTopic(courseId: string, topicId: string) {
    return this.getBundle(courseId)?.topics.find((item) => item.topicId === topicId) ?? { courseId, topicId };
  }

  async listAnnouncements(courseId: string) {
    return this.getBundle(courseId)?.announcements ?? [];
  }

  async getAnnouncement(courseId: string, announcementId: string) {
    return this.getBundle(courseId)?.announcements.find((item) => item.announcementId === announcementId) ?? { courseId, announcementId };
  }

  async listCourseWork(courseId: string) {
    return this.getBundle(courseId)?.courseWork ?? [];
  }

  async getCourseWork(courseId: string, courseWorkId: string) {
    return this.getBundle(courseId)?.courseWork.find((item) => item.courseWorkId === courseWorkId) ?? { courseId, courseWorkId };
  }

  async listRubrics(courseId: string, courseWorkId: string) {
    return this.getBundle(courseId)?.rubricsByCourseWorkId?.[courseWorkId] ?? [];
  }

  async getRubric(courseId: string, courseWorkId: string, rubricId: string) {
    return (
      this.getBundle(courseId)?.rubricsByCourseWorkId?.[courseWorkId]?.find((item) => item.rubricId === rubricId) ?? {
        courseId,
        courseWorkId,
        rubricId,
      }
    );
  }

  async listCourseWorkMaterials(courseId: string) {
    return this.getBundle(courseId)?.courseWorkMaterials ?? [];
  }

  async getCourseWorkMaterial(courseId: string, courseWorkMaterialId: string) {
    return (
      this.getBundle(courseId)?.courseWorkMaterials.find((item) => item.courseWorkMaterialId === courseWorkMaterialId) ?? {
        courseId,
        courseWorkMaterialId,
      }
    );
  }

  async listStudentSubmissions(courseId: string) {
    return this.getBundle(courseId)?.studentSubmissions ?? [];
  }

  async getStudentSubmission(courseId: string, courseWorkId: string, submissionId: string) {
    return (
      this.getBundle(courseId)?.studentSubmissions.find(
        (item) => item.courseWorkId === courseWorkId && item.submissionId === submissionId,
      ) ?? { courseId, courseWorkId, submissionId }
    );
  }

  async listStudents(courseId: string) {
    return this.getBundle(courseId)?.students ?? [];
  }

  async getStudent(courseId: string, userId: string) {
    return this.getBundle(courseId)?.students?.find((item) => item.userId === userId) ?? { courseId, userId };
  }

  async listTeachers(courseId: string) {
    return this.getBundle(courseId)?.teachers ?? [];
  }

  async getTeacher(courseId: string, userId: string) {
    return this.getBundle(courseId)?.teachers?.find((item) => item.userId === userId) ?? { courseId, userId };
  }

  async getUserProfile(userId: string) {
    return { userId, fullName: userId === "me" ? "Me" : userId, rawJson: { id: userId } };
  }

  async listInvitations() {
    return [];
  }

  async getInvitation(invitationId: string) {
    return { invitationId, rawJson: { id: invitationId } };
  }

  async listStudentGroups(courseId: string) {
    return this.getBundle(courseId)?.studentGroups ?? [];
  }

  async listStudentGroupMembers(courseId: string, studentGroupId: string) {
    return this.getBundle(courseId)?.studentGroupMembersByGroupId?.[studentGroupId] ?? [];
  }

  async listGuardians() {
    return [];
  }

  async getGuardian(studentId: string, guardianId: string) {
    return { studentId, guardianId, rawJson: { guardianId } };
  }

  async listGuardianInvitations() {
    return [];
  }

  async getGuardianInvitation(studentId: string, invitationId: string) {
    return { studentId, invitationId, rawJson: { invitationId } };
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

  async downloadBlob(_fileId: string) {
    return Buffer.from("pdf-content");
  }

  async exportFile(_fileId: string, _mimeType: string) {
    return Buffer.from("export-content");
  }

  async getAbout() {
    return { email: "student@example.com", displayName: "Student", permissionId: "perm-1" };
  }
}

class PartiallyFailingDriveService extends FakeDriveService {
  override async getFile(fileId: string) {
    if (fileId === "drive-missing") {
      throw new Error("Drive API returned 404");
    }

    return super.getFile(fileId);
  }
}

class ConcurrentDownloadDriveService extends FakeDriveService {
  maxConcurrentDownloads = 0;
  private activeDownloads = 0;

  override async downloadBlob(fileId: string) {
    this.activeDownloads += 1;
    this.maxConcurrentDownloads = Math.max(this.maxConcurrentDownloads, this.activeDownloads);

    await new Promise((resolve) => setTimeout(resolve, 25));

    this.activeDownloads -= 1;
    return Buffer.from(`pdf-content-${fileId}`);
  }
}

class PermissionDeniedClassroomService extends FakeClassroomService {
  override async listAnnouncements(courseId: string) {
    if (courseId === "course-2") {
      throw Object.assign(new Error("Forbidden"), { code: 403 });
    }

    return super.listAnnouncements(courseId);
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

    const db = openDatabase(paths.databasePath);
    const artifactCount = (db.prepare(`SELECT COUNT(*) AS count FROM drive_file_artifacts`).get() as { count: number }).count;
    const blobCount = (db.prepare(`SELECT COUNT(*) AS count FROM artifact_blobs`).get() as { count: number }).count;
    const statusCount = (db.prepare(`SELECT COUNT(*) AS count FROM sync_status_records`).get() as { count: number }).count;
    const summaryJson = (db.prepare(`SELECT summary_json AS summaryJson FROM sync_runs WHERE run_id = ?`).get(result.runId) as { summaryJson: string }).summaryJson;

    expect(artifactCount).toBe(1);
    expect(blobCount).toBe(1);
    expect(statusCount).toBeGreaterThan(0);
    expect(JSON.parse(summaryJson) as { counts: Record<string, number> }).toMatchObject({ counts: expect.any(Object) });
    closeDatabase(db);

    await expect(access(paths.databasePath)).resolves.toBeUndefined();
    await expect(access(path.join(outDir, "manifest.json"))).rejects.toThrow();
    await expect(access(path.join(outDir, "files"))).rejects.toThrow();
    await expect(access(path.join(outDir, "json"))).rejects.toThrow();
    await expect(access(path.join(outDir, "reports", "status-report.json"))).rejects.toThrow();
  });

  it("backs up Drive files attached to announcements", async () => {
    const outDir = path.join(os.tmpdir(), `classroom-backup-sync-announcements-${Date.now()}`);
    const paths = resolveAppPaths(outDir);
    await mkdir(paths.configRoot, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await mkdir(path.dirname(paths.oauthClientPath), { recursive: true });
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        paths.oauthClientPath,
        JSON.stringify({ clientId: "test-client", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] }),
      ),
    );

    const classroom = new FakeClassroomService([
      {
        course: { id: "course-1", name: "Math", courseState: "ACTIVE" },
        topics: [],
        announcements: [
          {
            courseId: "course-1",
            announcementId: "ann-1",
            text: "See attached",
            materials: [
              {
                driveFile: {
                  driveFile: { id: "drive-ann-1", alternateLink: "https://drive.google.com/file/d/drive-ann-1" },
                  shareMode: "VIEW",
                },
              },
            ],
          },
        ],
        courseWork: [],
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

    const db = openDatabase(paths.databasePath);
    const artifacts = db
      .prepare(`SELECT drive_file_id AS driveFileId, download_name AS downloadName FROM drive_file_artifacts ORDER BY artifact_id ASC`)
      .all() as Array<{ driveFileId: string; downloadName: string }>;
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.driveFileId).toBe("drive-ann-1");
    expect(artifacts[0]?.downloadName).toBe("worksheet.pdf");
    closeDatabase(db);
  });

  it("records file fetch failures and continues with remaining files", async () => {
    const outDir = path.join(os.tmpdir(), `classroom-backup-sync-partial-${Date.now()}`);
    const paths = resolveAppPaths(outDir);
    await mkdir(paths.configRoot, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await mkdir(path.dirname(paths.oauthClientPath), { recursive: true });
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        paths.oauthClientPath,
        JSON.stringify({ clientId: "test-client", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] }),
      ),
    );

    const logger = { log: vi.fn() };
    const classroom = new FakeClassroomService([
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
              {
                driveFile: {
                  driveFile: { id: "drive-missing", alternateLink: "https://drive.google.com/file/d/drive-missing" },
                  shareMode: "VIEW",
                },
              },
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
      services: { classroom, drive: new PartiallyFailingDriveService() },
      logger,
      now: () => "2026-03-31T00:00:00.000Z",
    });

    expect(result.status).toBe("partial");
    expect(result.artifacts).toHaveLength(1);
    expect(result.failuresCount).toBeGreaterThan(0);

    const db = openDatabase(paths.databasePath);
    const artifacts = db.prepare(`SELECT drive_file_id AS driveFileId FROM drive_file_artifacts ORDER BY artifact_id ASC`).all() as Array<{ driveFileId: string }>;
    const statusSummary = (db.prepare(`SELECT summary_json AS summaryJson FROM sync_runs WHERE run_id = ?`).get(result.runId) as { summaryJson: string }).summaryJson;
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.driveFileId).toBe("drive-1");
    expect((JSON.parse(statusSummary) as { failuresCount: number }).failuresCount).toBeGreaterThan(0);
    closeDatabase(db);

    expect(logger.log).toHaveBeenCalledWith("Fetching 2 Drive files...");
    expect(logger.log).toHaveBeenCalledWith("[1/2] Failed to fetch Drive file drive-missing; continuing.");
  });

  it("downloads multiple Drive files concurrently", async () => {
    const outDir = path.join(os.tmpdir(), `classroom-backup-sync-concurrent-${Date.now()}`);
    const paths = resolveAppPaths(outDir);
    await mkdir(paths.configRoot, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await mkdir(path.dirname(paths.oauthClientPath), { recursive: true });
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        paths.oauthClientPath,
        JSON.stringify({ clientId: "test-client", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] }),
      ),
    );

    const drive = new ConcurrentDownloadDriveService();
    const classroom = new FakeClassroomService([
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
              {
                driveFile: {
                  driveFile: { id: "drive-1", alternateLink: "https://drive.google.com/file/d/drive-1" },
                  shareMode: "VIEW",
                },
              },
              {
                driveFile: {
                  driveFile: { id: "drive-2", alternateLink: "https://drive.google.com/file/d/drive-2" },
                  shareMode: "VIEW",
                },
              },
              {
                driveFile: {
                  driveFile: { id: "drive-3", alternateLink: "https://drive.google.com/file/d/drive-3" },
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
      driveConcurrency: 2,
      services: { classroom, drive },
      now: () => "2026-03-31T00:00:00.000Z",
    });

    expect(result.status).toBe("success");
    expect(result.artifacts).toHaveLength(3);
    expect(drive.maxConcurrentDownloads).toBeGreaterThan(1);
    expect(drive.maxConcurrentDownloads).toBeLessThanOrEqual(2);
  });

  it("preserves raw Classroom fields for viewer rendering", async () => {
    const outDir = path.join(os.tmpdir(), `classroom-backup-sync-raw-json-${Date.now()}`);
    const paths = resolveAppPaths(outDir);
    await mkdir(paths.configRoot, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await mkdir(path.dirname(paths.oauthClientPath), { recursive: true });
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        paths.oauthClientPath,
        JSON.stringify({ clientId: "test-client", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] }),
      ),
    );

    const classroom = new FakeClassroomService([
      {
        course: { id: "course-1", name: "Math", courseState: "ACTIVE" },
        topics: [],
        announcements: [
          {
            courseId: "course-1",
            announcementId: "ann-1",
            text: "Class update",
            rawJson: { creatorUserProfile: { name: "Teacher Announcement" } },
          },
        ],
        courseWork: [
          {
            courseId: "course-1",
            courseWorkId: "cw-1",
            title: "Assignment",
            description: "Solve the worksheet",
            workType: "ASSIGNMENT",
            updateTime: "2026-03-31T10:00:00.000Z",
            rawJson: {
              creatorUserProfile: { name: "Teacher Work" },
              creationTime: "2026-03-29T09:00:00.000Z",
              dueDate: { year: 2026, month: 4, day: 2 },
              dueTime: { hours: 9, minutes: 30 },
              maxPoints: 100,
            },
          },
        ],
        courseWorkMaterials: [],
        studentSubmissions: [],
      },
    ]);

    await runFullSync({
      out: outDir,
      services: { classroom, drive: new FakeDriveService() },
      now: () => "2026-03-31T00:00:00.000Z",
    });

    const db = openDatabase(paths.databasePath);
    const readModel = new ViewerReadModel(db);
    const stream = readModel.getCourseStream("course-1");
    const announcement = stream?.items.find((item) => item.id === "ann-1");
    const courseWork = stream?.items.find((item) => item.id === "cw-1");

    expect(announcement?.authorName).toBe("Teacher Announcement");
    expect(courseWork?.authorName).toBe("Teacher Work");
    expect(courseWork?.createdTime).toBe("2026-03-29T09:00:00.000Z");
    expect(courseWork?.pointsLabel).toBe("100 点");
    expect(courseWork?.dueLabel).toContain("提出期限:");

    closeDatabase(db);
  });

  it("continues syncing other courses when one course resource is denied", async () => {
    const outDir = path.join(os.tmpdir(), `classroom-backup-sync-course-partial-${Date.now()}`);
    const paths = resolveAppPaths(outDir);
    await mkdir(paths.configRoot, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await mkdir(path.dirname(paths.oauthClientPath), { recursive: true });
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        paths.oauthClientPath,
        JSON.stringify({ clientId: "test-client", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] }),
      ),
    );

    const classroom = new PermissionDeniedClassroomService([
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
      {
        course: { id: "course-2", name: "Science", courseState: "ACTIVE" },
        topics: [],
        announcements: [],
        courseWork: [],
        courseWorkMaterials: [],
        studentSubmissions: [],
      },
    ]);

    const result = await runFullSync({
      out: outDir,
      services: { classroom, drive: new FakeDriveService() },
      now: () => "2026-03-31T00:00:00.000Z",
    });

    expect(result.status).toBe("partial");

    const db = openDatabase(paths.databasePath);
    const courseRows = db
      .prepare(`SELECT course_id AS courseId, visibility_status AS visibilityStatus FROM courses ORDER BY course_id ASC`)
      .all() as Array<{ courseId: string; visibilityStatus: string }>;
    const statusReport = JSON.parse(
      (db.prepare(`SELECT summary_json AS summaryJson FROM sync_runs WHERE run_id = ?`).get(result.runId) as { summaryJson: string }).summaryJson,
    ) as { counts: Record<string, number> };

    expect(courseRows).toEqual([
      { courseId: "course-1", visibilityStatus: "visible" },
      { courseId: "course-2", visibilityStatus: "permission_denied" },
    ]);
    expect(statusReport.counts.failed).toBeGreaterThan(0);
    expect(result.artifacts[0]?.driveFileId).toBe("drive-1");

    closeDatabase(db);
  });

  it("matches STUDENT_COPY templates to submissions by courseWork", async () => {
    const outDir = path.join(os.tmpdir(), `classroom-backup-sync-student-copy-${Date.now()}`);
    const paths = resolveAppPaths(outDir);
    await mkdir(paths.configRoot, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await mkdir(path.dirname(paths.oauthClientPath), { recursive: true });
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        paths.oauthClientPath,
        JSON.stringify({ clientId: "test-client", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] }),
      ),
    );

    const classroom = new FakeClassroomService([
      {
        course: { id: "course-1", name: "Math", courseState: "ACTIVE" },
        topics: [],
        announcements: [],
        courseWork: [
          {
            courseId: "course-1",
            courseWorkId: "cw-1",
            title: "Assignment 1",
            materials: [
              {
                driveFile: {
                  driveFile: { id: "template-1", alternateLink: "https://drive.google.com/file/d/template-1" },
                  shareMode: "STUDENT_COPY",
                },
              },
            ],
          },
          {
            courseId: "course-1",
            courseWorkId: "cw-2",
            title: "Assignment 2",
            materials: [
              {
                driveFile: {
                  driveFile: { id: "template-2", alternateLink: "https://drive.google.com/file/d/template-2" },
                  shareMode: "STUDENT_COPY",
                },
              },
            ],
          },
        ],
        courseWorkMaterials: [],
        studentSubmissions: [
          {
            courseId: "course-1",
            courseWorkId: "cw-2",
            submissionId: "submission-2",
            assignmentSubmission: {
              attachments: [{ driveFile: { id: "drive-2", alternateLink: "https://drive.google.com/file/d/drive-2" } }],
            },
          },
          {
            courseId: "course-1",
            courseWorkId: "cw-1",
            submissionId: "submission-1",
            assignmentSubmission: {
              attachments: [{ driveFile: { id: "drive-1", alternateLink: "https://drive.google.com/file/d/drive-1" } }],
            },
          },
        ],
      },
    ]);

    await runFullSync({
      out: outDir,
      services: { classroom, drive: new FakeDriveService() },
      now: () => "2026-03-31T00:00:00.000Z",
    });

    const db = openDatabase(paths.databasePath);
    const refs = db
      .prepare(
        `SELECT submission_id AS submissionId, course_work_id AS courseWorkId, template_drive_file_id AS templateDriveFileId
         FROM drive_file_refs
         WHERE submission_id IS NOT NULL
         ORDER BY submission_id ASC`,
      )
      .all() as Array<{ submissionId: string; courseWorkId: string; templateDriveFileId: string | null }>;

    expect(refs).toEqual([
      { submissionId: "submission-1", courseWorkId: "cw-1", templateDriveFileId: "template-1" },
      { submissionId: "submission-2", courseWorkId: "cw-2", templateDriveFileId: "template-2" },
    ]);

    closeDatabase(db);
  });
});
