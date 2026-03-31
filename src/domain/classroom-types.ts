export type CourseVisibilityStatus = "visible" | "not_returned" | "permission_denied";
export type ArtifactStatus = "pending" | "saved" | "skipped" | "failed";
export type MaterializationState = "ready" | "pending_materialization" | "unavailable";
export type SourceType = "course_material" | "submission_attachment";
export type SyncRunPhase = "pending" | "classroom" | "drive" | "reporting" | "completed";
export type SyncRunStatus = "running" | "success" | "partial" | "failed";
export type StatusKind = "success" | "partial" | "skipped" | "failed" | "unsupported";

export interface SyncableCourse {
  id: string;
  name?: string | null;
  section?: string | null;
  descriptionHeading?: string | null;
  description?: string | null;
  room?: string | null;
  ownerId?: string | null;
  courseState?: string | null;
  alternateLink?: string | null;
  creationTime?: string | null;
  updateTime?: string | null;
}

export interface SyncableTopic {
  courseId: string;
  topicId: string;
  name?: string | null;
  updateTime?: string | null;
}

export interface SyncableAnnouncement {
  courseId: string;
  announcementId: string;
  text?: string | null;
  state?: string | null;
  alternateLink?: string | null;
  creationTime?: string | null;
  updateTime?: string | null;
  materials?: unknown[];
}

export interface SyncableCourseWork {
  courseId: string;
  courseWorkId: string;
  title?: string | null;
  description?: string | null;
  workType?: string | null;
  state?: string | null;
  alternateLink?: string | null;
  topicId?: string | null;
  updateTime?: string | null;
  materials?: unknown[];
}

export interface SyncableCourseWorkMaterial {
  courseId: string;
  courseWorkMaterialId: string;
  title?: string | null;
  description?: string | null;
  state?: string | null;
  alternateLink?: string | null;
  topicId?: string | null;
  updateTime?: string | null;
  materials?: unknown[];
}

export interface SyncableStudentSubmission {
  courseId: string;
  courseWorkId: string;
  submissionId: string;
  userId?: string | null;
  state?: string | null;
  late?: boolean | null;
  courseWorkType?: string | null;
  associatedWithDeveloper?: boolean | null;
  creationTime?: string | null;
  updateTime?: string | null;
  assignmentSubmission?: {
    attachments?: unknown[];
  } | null;
  shortAnswerSubmission?: {
    answer?: string | null;
  } | null;
  multipleChoiceSubmission?: {
    answer?: string | null;
  } | null;
  submissionHistory?: unknown[];
  draftGrade?: number | null;
  assignedGrade?: number | null;
  alternateLink?: string | null;
}

export interface DriveReferenceRecord {
  courseId: string;
  announcementId?: string | null;
  courseWorkId?: string | null;
  courseWorkMaterialId?: string | null;
  submissionId?: string | null;
  sourceType: SourceType;
  driveFileId?: string | null;
  templateDriveFileId?: string | null;
  submissionDriveFileId?: string | null;
  shareMode?: string | null;
  materializationState: MaterializationState;
  linkUrl?: string | null;
  attachmentType: string;
}

export interface DriveFileRecord {
  driveFileId: string;
  name?: string | null;
  mimeType?: string | null;
  md5Checksum?: string | null;
  size?: string | null;
  modifiedTime?: string | null;
  version?: string | null;
  trashed?: boolean | null;
  webViewLink?: string | null;
  exportLinks?: Record<string, string> | null;
}

export interface DriveCommentRecord {
  driveFileId: string;
  commentId: string;
  content?: string | null;
  authorDisplayName?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
  resolved?: boolean | null;
  deleted?: boolean | null;
  quotedFileContentValue?: string | null;
  repliesJson: unknown[];
}

export interface SyncFailureRecord {
  runId: string;
  scope: string;
  entityType: string;
  entityId?: string | null;
  status: "unsupported" | "skipped" | "failed";
  reasonCode: string;
  message: string;
  detailsJson?: unknown;
}

export interface StatusRecord {
  runId: string;
  scope: string;
  entityType: string;
  entityId: string;
  status: StatusKind;
  message: string;
}

export interface SyncCheckpoint {
  accountKey: string;
  committedStartPageToken?: string | null;
  lastSuccessfulRunId?: string | null;
  lastClassroomSyncAt?: string | null;
}

export interface ManifestArtifactEntry {
  driveFileId: string;
  artifactKind: "blob" | "export";
  outputMimeType?: string | null;
  relativePath: string;
  status: ArtifactStatus;
  sizeBytes?: number | null;
  checksumType?: string | null;
  checksumValue?: string | null;
  sourceModifiedTime?: string | null;
}
