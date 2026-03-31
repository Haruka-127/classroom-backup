import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { resolveAppPaths } from "../../src/config/app-paths.js";
import { closeDatabase, openDatabase } from "../../src/storage/db.js";
import { runFullSync } from "../../src/sync/full-sync.js";
import { runIncrementalSync } from "../../src/sync/incremental-sync.js";
import type { ClassroomService, CourseBundle } from "../../src/lib/google/classroom-client.js";
import type { DriveService } from "../../src/lib/google/drive-client.js";

class ClassroomFixtureService implements ClassroomService {
  constructor(private readonly bundles: CourseBundle[]) {}

  private getBundle(courseId: string) { return this.bundles.find((bundle) => bundle.course.id === courseId); }

  async listCourses() { return this.bundles.map((bundle) => bundle.course); }
  async getCourse(courseId: string) { return this.getBundle(courseId)?.course ?? { id: courseId }; }
  async listCourseAliases(courseId: string) { return this.getBundle(courseId)?.aliases ?? []; }
  async getGradingPeriodSettings(courseId: string) {
    return this.getBundle(courseId)?.gradingPeriodSettings ?? { courseId, rawJson: {} };
  }
  async listTopics(courseId: string) { return this.getBundle(courseId)?.topics ?? []; }
  async getTopic(courseId: string, topicId: string) { return this.getBundle(courseId)?.topics.find((item) => item.topicId === topicId) ?? { courseId, topicId }; }
  async listAnnouncements(courseId: string) { return this.getBundle(courseId)?.announcements ?? []; }
  async getAnnouncement(courseId: string, announcementId: string) { return this.getBundle(courseId)?.announcements.find((item) => item.announcementId === announcementId) ?? { courseId, announcementId }; }
  async listCourseWork(courseId: string) { return this.getBundle(courseId)?.courseWork ?? []; }
  async getCourseWork(courseId: string, courseWorkId: string) { return this.getBundle(courseId)?.courseWork.find((item) => item.courseWorkId === courseWorkId) ?? { courseId, courseWorkId }; }
  async listRubrics(courseId: string, courseWorkId: string) { return this.getBundle(courseId)?.rubricsByCourseWorkId?.[courseWorkId] ?? []; }
  async getRubric(courseId: string, courseWorkId: string, rubricId: string) { return this.getBundle(courseId)?.rubricsByCourseWorkId?.[courseWorkId]?.find((item) => item.rubricId === rubricId) ?? { courseId, courseWorkId, rubricId }; }
  async listCourseWorkMaterials(courseId: string) { return this.getBundle(courseId)?.courseWorkMaterials ?? []; }
  async getCourseWorkMaterial(courseId: string, courseWorkMaterialId: string) { return this.getBundle(courseId)?.courseWorkMaterials.find((item) => item.courseWorkMaterialId === courseWorkMaterialId) ?? { courseId, courseWorkMaterialId }; }
  async listStudentSubmissions(courseId: string) { return this.getBundle(courseId)?.studentSubmissions ?? []; }
  async getStudentSubmission(courseId: string, courseWorkId: string, submissionId: string) { return this.getBundle(courseId)?.studentSubmissions.find((item) => item.courseWorkId === courseWorkId && item.submissionId === submissionId) ?? { courseId, courseWorkId, submissionId }; }
  async listStudents(courseId: string) { return this.getBundle(courseId)?.students ?? []; }
  async getStudent(courseId: string, userId: string) { return this.getBundle(courseId)?.students?.find((item) => item.userId === userId) ?? { courseId, userId }; }
  async listTeachers(courseId: string) { return this.getBundle(courseId)?.teachers ?? []; }
  async getTeacher(courseId: string, userId: string) { return this.getBundle(courseId)?.teachers?.find((item) => item.userId === userId) ?? { courseId, userId }; }
  async getUserProfile(userId: string) { return { userId, fullName: userId, rawJson: { id: userId } }; }
  async listInvitations() { return []; }
  async getInvitation(invitationId: string) { return { invitationId, rawJson: { id: invitationId } }; }
  async listStudentGroups(courseId: string) { return this.getBundle(courseId)?.studentGroups ?? []; }
  async listStudentGroupMembers(courseId: string, studentGroupId: string) { return this.getBundle(courseId)?.studentGroupMembersByGroupId?.[studentGroupId] ?? []; }
  async listGuardians() { return []; }
  async getGuardian(studentId: string, guardianId: string) { return { studentId, guardianId, rawJson: { guardianId } }; }
  async listGuardianInvitations() { return []; }
  async getGuardianInvitation(studentId: string, invitationId: string) { return { studentId, invitationId, rawJson: { invitationId } }; }
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
    const db = openDatabase(paths.databasePath);
    const artifactCount = (db.prepare(`SELECT COUNT(*) AS count FROM drive_file_artifacts`).get() as { count: number }).count;
    expect(artifactCount).toBeGreaterThan(0);
    closeDatabase(db);
    expect(logger.log).toHaveBeenCalledWith("Starting incremental sync");
    expect(logger.log).toHaveBeenCalledWith("Re-fetched 1 changed Drive files since last committed checkpoint.");
  });
});
