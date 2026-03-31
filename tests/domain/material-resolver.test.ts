import { describe, expect, it } from "vitest";

import {
  resolveCourseMaterialDriveReferences,
  resolveSubmissionDriveReferences,
} from "../../src/domain/material-resolver.js";

describe("material resolver", () => {
  it("marks STUDENT_COPY materials as pending materialization", () => {
    const refs = resolveCourseMaterialDriveReferences({
      courseId: "course-1",
      announcementId: "ann-1",
      courseWorkId: "cw-1",
      materials: [
        {
          driveFile: {
            driveFile: { id: "template-1", alternateLink: "https://drive.google.com/file/d/template-1" },
            shareMode: "STUDENT_COPY",
          },
        },
      ],
    });

    expect(refs).toEqual([
      expect.objectContaining({
        announcementId: "ann-1",
        templateDriveFileId: "template-1",
        materializationState: "pending_materialization",
        shareMode: "STUDENT_COPY",
      }),
    ]);
  });

  it("links submission attachments back to templates when present", () => {
    const refs = resolveSubmissionDriveReferences({
      courseId: "course-1",
      courseWorkId: "cw-1",
      submissionId: "submission-1",
      templateDriveFileIds: ["template-1"],
      attachments: [{ driveFile: { id: "copy-1", alternateLink: "https://drive.google.com/file/d/copy-1" } }],
    });

    expect(refs).toEqual([
      expect.objectContaining({
        driveFileId: "copy-1",
        templateDriveFileId: "template-1",
        submissionDriveFileId: "copy-1",
        materializationState: "ready",
      }),
    ]);
  });
});
