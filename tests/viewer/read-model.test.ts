import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { openDatabase, closeDatabase } from "../../src/storage/db.js";
import { ViewerReadModel } from "../../src/viewer/read-model.js";
import { createRepositories } from "../../src/storage/repositories/index.js";

async function createViewerFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "classroom-viewer-read-model-"));
  const databasePath = path.join(root, "backup.sqlite");
  const db = openDatabase(databasePath);
  const repositories = createRepositories(db);

  repositories.courses.upsert(
    {
      id: "course-1",
      name: "Math",
      section: "Section A",
      room: "Room 101",
      descriptionHeading: "Welcome",
      description: "Course description",
      courseState: "ACTIVE",
      updateTime: "2026-03-30T10:00:00.000Z",
    },
    "run-1",
  );
  repositories.topics.replaceForCourse("course-1", [{ courseId: "course-1", topicId: "topic-1", name: "Week 1" }]);
  repositories.announcements.replaceForCourse("course-1", [
    {
      courseId: "course-1",
      announcementId: "ann-1",
      text: "Hello class",
      creationTime: "2026-03-29T10:00:00.000Z",
      materials: [
        {
          driveFile: {
            driveFile: { id: "drive-ann-1", title: "Announcement.pdf", alternateLink: "https://drive.example/drive-ann-1" },
            shareMode: "VIEW",
          },
        },
      ],
    },
  ]);
  repositories.courseWork.replaceForCourse("course-1", [
    {
      courseId: "course-1",
      courseWorkId: "cw-1",
      title: "Assignment 1",
      description: "Solve the worksheet",
      workType: "ASSIGNMENT",
      topicId: "topic-1",
      updateTime: "2026-03-30T11:00:00.000Z",
      materials: [
        {
          driveFile: {
            driveFile: { id: "drive-1", title: "Worksheet.pdf", alternateLink: "https://drive.example/drive-1" },
            shareMode: "VIEW",
          },
        },
      ],
    },
  ]);
  repositories.courseWorkMaterials.replaceForCourse("course-1", [
    {
      courseId: "course-1",
      courseWorkMaterialId: "cwm-1",
      title: "Reference doc",
      description: "Read this first",
      topicId: null,
      updateTime: "2026-03-28T11:00:00.000Z",
      materials: [{ link: { url: "https://example.com/resource" } }],
    },
  ]);
  repositories.studentSubmissions.replaceForCourse("course-1", [
    {
      courseId: "course-1",
      courseWorkId: "cw-1",
      submissionId: "submission-1",
      state: "TURNED_IN",
      shortAnswerSubmission: { answer: "42" },
      assignedGrade: 95,
      assignmentSubmission: { attachments: [{ driveFile: { id: "drive-2", title: "Answer.pdf", alternateLink: "https://drive.example/drive-2" } }] },
    },
  ]);
  repositories.driveFileRefs.replaceForCourse("course-1", [
    {
      courseId: "course-1",
      announcementId: "ann-1",
      courseWorkId: null,
      courseWorkMaterialId: null,
      submissionId: null,
      sourceType: "course_material",
      attachmentType: "drive_file",
      driveFileId: "drive-ann-1",
      templateDriveFileId: null,
      submissionDriveFileId: null,
      shareMode: "VIEW",
      materializationState: "ready",
      linkUrl: "https://drive.example/drive-ann-1",
    },
    {
      courseId: "course-1",
      announcementId: null,
      courseWorkId: "cw-1",
      submissionId: null,
      sourceType: "course_material",
      attachmentType: "drive_file",
      driveFileId: "drive-1",
      templateDriveFileId: null,
      submissionDriveFileId: null,
      shareMode: "VIEW",
      materializationState: "ready",
      linkUrl: "https://drive.example/drive-1",
    },
    {
      courseId: "course-1",
      announcementId: null,
      courseWorkId: null,
      courseWorkMaterialId: "cwm-1",
      submissionId: null,
      sourceType: "course_material",
      attachmentType: "link",
      driveFileId: null,
      templateDriveFileId: null,
      submissionDriveFileId: null,
      shareMode: null,
      materializationState: "unavailable",
      linkUrl: "https://example.com/resource",
    },
    {
      courseId: "course-1",
      announcementId: null,
      courseWorkId: "cw-1",
      submissionId: "submission-1",
      sourceType: "submission_attachment",
      attachmentType: "drive_file",
      driveFileId: "drive-2",
      templateDriveFileId: null,
      submissionDriveFileId: "drive-2",
      shareMode: null,
      materializationState: "ready",
      linkUrl: "https://drive.example/drive-2",
    },
  ]);
  repositories.driveFiles.upsert({ driveFileId: "drive-1", name: "Worksheet.pdf", mimeType: "application/pdf", size: "123" });
  repositories.driveFiles.upsert({ driveFileId: "drive-2", name: "Answer.pdf", mimeType: "application/pdf", size: "456" });
  repositories.driveFiles.upsert({ driveFileId: "drive-ann-1", name: "Announcement.pdf", mimeType: "application/pdf", size: "321" });
  repositories.driveFileArtifacts.upsert({
    driveFileId: "drive-ann-1",
    artifactKind: "blob",
    outputMimeType: "application/pdf",
    relativePath: "drive-ann-1/blob.pdf",
    status: "saved",
    sizeBytes: 321,
  });
  repositories.driveFileArtifacts.upsert({
    driveFileId: "drive-1",
    artifactKind: "blob",
    outputMimeType: "application/pdf",
    relativePath: "drive-1/blob.pdf",
    status: "saved",
    sizeBytes: 123,
  });
  repositories.driveFileArtifacts.upsert({
    driveFileId: "drive-2",
    artifactKind: "blob",
    outputMimeType: "application/pdf",
    relativePath: "drive-2/blob.pdf",
    status: "saved",
    sizeBytes: 456,
  });

  await writeFile(path.join(root, "touch.txt"), "ok");
  return { root, databasePath, db };
}

describe("ViewerReadModel", () => {
  it("builds course, stream, classwork, and detail data from SQLite", async () => {
    const fixture = await createViewerFixture();
    const readModel = new ViewerReadModel(fixture.db);

    expect(readModel.listCourses().courses).toHaveLength(1);
    expect(readModel.getCourse("course-1")?.name).toBe("Math");
    expect(readModel.getCourseStream("course-1")?.items[0]?.itemType).toBe("course_work");
    expect(readModel.getCourseStream("course-1")?.items.find((item) => item.id === "ann-1")?.attachments[0]?.driveFile?.artifacts[0]?.url).toBe(
      "/api/artifacts/drive-ann-1/blob.pdf",
    );
    expect(readModel.getCourseClasswork("course-1")?.sections).toHaveLength(2);
    expect(readModel.getCourseWorkDetail("course-1", "cw-1")?.submission?.shortAnswer).toBe("42");
    expect(readModel.getCourseWorkMaterialDetail("course-1", "cwm-1")?.attachments[0]?.notices[0]?.code).toBe("unavailable");

    closeDatabase(fixture.db);
  });

  it("falls back to announcement raw_json when reading older databases", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "classroom-viewer-read-model-legacy-"));
    const databasePath = path.join(root, "backup.sqlite");
    const db = new Database(databasePath);

    db.exec(`
      CREATE TABLE courses (
        course_id TEXT PRIMARY KEY,
        name TEXT,
        section TEXT,
        description_heading TEXT,
        description TEXT,
        room TEXT,
        course_state TEXT,
        alternate_link TEXT,
        creation_time TEXT,
        update_time TEXT,
        visibility_status TEXT NOT NULL DEFAULT 'visible'
      );
      CREATE TABLE announcements (
        course_id TEXT NOT NULL,
        announcement_id TEXT NOT NULL,
        text TEXT,
        state TEXT,
        alternate_link TEXT,
        creation_time TEXT,
        update_time TEXT,
        raw_json TEXT NOT NULL,
        PRIMARY KEY (course_id, announcement_id)
      );
      CREATE TABLE topics (
        course_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        name TEXT,
        update_time TEXT,
        raw_json TEXT NOT NULL,
        PRIMARY KEY (course_id, topic_id)
      );
      CREATE TABLE course_work (
        course_id TEXT NOT NULL,
        course_work_id TEXT NOT NULL,
        title TEXT,
        description TEXT,
        work_type TEXT,
        state TEXT,
        alternate_link TEXT,
        topic_id TEXT,
        update_time TEXT,
        raw_json TEXT NOT NULL,
        PRIMARY KEY (course_id, course_work_id)
      );
      CREATE TABLE drive_file_refs (
        ref_id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id TEXT NOT NULL,
        course_work_id TEXT,
        course_work_material_id TEXT,
        submission_id TEXT,
        source_type TEXT NOT NULL,
        attachment_type TEXT NOT NULL,
        drive_file_id TEXT,
        template_drive_file_id TEXT,
        submission_drive_file_id TEXT,
        share_mode TEXT,
        materialization_state TEXT NOT NULL,
        link_url TEXT,
        raw_json TEXT NOT NULL
      );
      CREATE TABLE drive_files (
        drive_file_id TEXT PRIMARY KEY,
        name TEXT,
        mime_type TEXT,
        size TEXT,
        modified_time TEXT,
        web_view_link TEXT
      );
      CREATE TABLE drive_file_artifacts (
        artifact_id INTEGER PRIMARY KEY AUTOINCREMENT,
        drive_file_id TEXT NOT NULL,
        artifact_kind TEXT NOT NULL,
        output_mime_type TEXT NOT NULL DEFAULT '',
        relative_path TEXT NOT NULL,
        status TEXT NOT NULL,
        size_bytes INTEGER
      );
    `);

    db.prepare(
      `INSERT INTO courses (
         course_id, name, section, description_heading, description, room, course_state,
         alternate_link, creation_time, update_time, visibility_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("course-1", "Math", null, null, null, null, "ACTIVE", null, null, "2026-03-30T10:00:00.000Z", "visible");
    db.prepare(
      `INSERT INTO announcements (
         course_id, announcement_id, text, state, alternate_link, creation_time, update_time, raw_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "course-1",
      "ann-1",
      "Legacy announcement",
      null,
      null,
      "2026-03-29T10:00:00.000Z",
      "2026-03-29T10:00:00.000Z",
      JSON.stringify({
        materials: [
          {
            driveFile: {
              driveFile: { id: "drive-legacy-1", title: "Legacy.pdf", alternateLink: "https://drive.example/drive-legacy-1" },
              shareMode: "VIEW",
            },
          },
        ],
      }),
    );
    db.prepare(`INSERT INTO drive_files (drive_file_id, name, mime_type, size, modified_time, web_view_link) VALUES (?, ?, ?, ?, ?, ?)`).run(
      "drive-legacy-1",
      "Legacy.pdf",
      "application/pdf",
      "123",
      null,
      null,
    );
    db.prepare(
      `INSERT INTO drive_file_artifacts (
         drive_file_id, artifact_kind, output_mime_type, relative_path, status, size_bytes
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("drive-legacy-1", "blob", "application/pdf", "drive-legacy-1/blob.pdf", "saved", 123);

    const readModel = new ViewerReadModel(db);

    expect(readModel.getCourseStream("course-1")?.items.find((item) => item.id === "ann-1")?.attachments[0]?.driveFile?.artifacts[0]?.url).toBe(
      "/api/artifacts/drive-legacy-1/blob.pdf",
    );

    db.close();
  });
});
