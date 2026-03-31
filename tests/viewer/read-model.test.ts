import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

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
    { courseId: "course-1", announcementId: "ann-1", text: "Hello class", creationTime: "2026-03-29T10:00:00.000Z" },
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
    expect(readModel.getCourseClasswork("course-1")?.sections).toHaveLength(2);
    expect(readModel.getCourseWorkDetail("course-1", "cw-1")?.submission?.shortAnswer).toBe("42");
    expect(readModel.getCourseWorkMaterialDetail("course-1", "cwm-1")?.attachments[0]?.notices[0]?.code).toBe("unavailable");

    closeDatabase(fixture.db);
  });
});
