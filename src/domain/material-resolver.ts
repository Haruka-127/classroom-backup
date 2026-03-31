import type { DriveReferenceRecord } from "./classroom-types.js";

type ClassroomMaterial = {
  driveFile?: {
    driveFile?: {
      id?: string | null;
      title?: string | null;
      alternateLink?: string | null;
    } | null;
    shareMode?: string | null;
  } | null;
  link?: {
    url?: string | null;
  } | null;
  youtubeVideo?: {
    alternateLink?: string | null;
  } | null;
  form?: {
    formUrl?: string | null;
  } | null;
};

type SubmissionAttachment = {
  driveFile?: {
    id?: string | null;
    title?: string | null;
    alternateLink?: string | null;
  } | null;
  link?: {
    url?: string | null;
  } | null;
};

function createBaseReference(record: Omit<DriveReferenceRecord, "attachmentType"> & { attachmentType?: string }): DriveReferenceRecord {
  return {
    attachmentType: record.attachmentType ?? (record.driveFileId ? "drive_file" : "external_link"),
    ...record,
  };
}

export function resolveCourseMaterialDriveReferences(args: {
  courseId: string;
  courseWorkId?: string | null;
  courseWorkMaterialId?: string | null;
  materials?: unknown[] | null;
}): DriveReferenceRecord[] {
  const materials = (args.materials ?? []) as ClassroomMaterial[];

  return materials.flatMap((material) => {
    if (material.driveFile?.driveFile?.id) {
      const shareMode = material.driveFile.shareMode ?? null;
      const driveFileId = material.driveFile.driveFile.id;

      return [
        createBaseReference({
          courseId: args.courseId,
          courseWorkId: args.courseWorkId ?? null,
          courseWorkMaterialId: args.courseWorkMaterialId ?? null,
          submissionId: null,
          sourceType: "course_material",
          driveFileId: shareMode === "STUDENT_COPY" ? null : driveFileId,
          templateDriveFileId: shareMode === "STUDENT_COPY" ? driveFileId : null,
          submissionDriveFileId: null,
          shareMode,
          materializationState: shareMode === "STUDENT_COPY" ? "pending_materialization" : "ready",
          linkUrl: material.driveFile.driveFile.alternateLink ?? null,
        }),
      ];
    }

    if (material.link?.url) {
      return [
        createBaseReference({
          courseId: args.courseId,
          courseWorkId: args.courseWorkId ?? null,
          courseWorkMaterialId: args.courseWorkMaterialId ?? null,
          submissionId: null,
          sourceType: "course_material",
          driveFileId: null,
          templateDriveFileId: null,
          submissionDriveFileId: null,
          shareMode: null,
          materializationState: "unavailable",
          linkUrl: material.link.url,
          attachmentType: "link",
        }),
      ];
    }

    if (material.youtubeVideo?.alternateLink) {
      return [
        createBaseReference({
          courseId: args.courseId,
          courseWorkId: args.courseWorkId ?? null,
          courseWorkMaterialId: args.courseWorkMaterialId ?? null,
          submissionId: null,
          sourceType: "course_material",
          driveFileId: null,
          templateDriveFileId: null,
          submissionDriveFileId: null,
          shareMode: null,
          materializationState: "unavailable",
          linkUrl: material.youtubeVideo.alternateLink,
          attachmentType: "youtube",
        }),
      ];
    }

    if (material.form?.formUrl) {
      return [
        createBaseReference({
          courseId: args.courseId,
          courseWorkId: args.courseWorkId ?? null,
          courseWorkMaterialId: args.courseWorkMaterialId ?? null,
          submissionId: null,
          sourceType: "course_material",
          driveFileId: null,
          templateDriveFileId: null,
          submissionDriveFileId: null,
          shareMode: null,
          materializationState: "unavailable",
          linkUrl: material.form.formUrl,
          attachmentType: "form",
        }),
      ];
    }

    return [];
  });
}

export function resolveSubmissionDriveReferences(args: {
  courseId: string;
  courseWorkId: string;
  submissionId: string;
  templateDriveFileIds?: string[];
  attachments?: unknown[] | null;
}): DriveReferenceRecord[] {
  const attachments = (args.attachments ?? []) as SubmissionAttachment[];
  const remainingTemplateIds = [...(args.templateDriveFileIds ?? [])];

  return attachments.flatMap((attachment) => {
    if (attachment.driveFile?.id) {
      const driveFileId = attachment.driveFile.id;
      const templateDriveFileId = remainingTemplateIds.shift() ?? null;

      return [
        createBaseReference({
          courseId: args.courseId,
          courseWorkId: args.courseWorkId,
          courseWorkMaterialId: null,
          submissionId: args.submissionId,
          sourceType: "submission_attachment",
          driveFileId,
          templateDriveFileId,
          submissionDriveFileId: driveFileId,
          shareMode: templateDriveFileId ? "STUDENT_COPY" : null,
          materializationState: "ready",
          linkUrl: attachment.driveFile.alternateLink ?? null,
        }),
      ];
    }

    if (attachment.link?.url) {
      return [
        createBaseReference({
          courseId: args.courseId,
          courseWorkId: args.courseWorkId,
          courseWorkMaterialId: null,
          submissionId: args.submissionId,
          sourceType: "submission_attachment",
          driveFileId: null,
          templateDriveFileId: null,
          submissionDriveFileId: null,
          shareMode: null,
          materializationState: "unavailable",
          linkUrl: attachment.link.url,
          attachmentType: "link",
        }),
      ];
    }

    return [];
  });
}
