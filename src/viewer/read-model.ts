import type Database from "better-sqlite3";

import type {
  ViewerAttachment,
  ViewerClassworkResponse,
  ViewerCourseCard,
  ViewerCourseDetail,
  ViewerCourseListResponse,
  ViewerCourseWorkDetail,
  ViewerCourseWorkMaterialDetail,
  ViewerDriveFile,
  ViewerStateNotice,
  ViewerStreamItem,
  ViewerStreamResponse,
  ViewerSubmissionSummary,
} from "./types.js";

type RawJsonRecord = Record<string, unknown>;

interface CourseRow {
  courseId: string;
  name: string | null;
  section: string | null;
  room: string | null;
  descriptionHeading: string | null;
  description: string | null;
  courseState: string | null;
  alternateLink: string | null;
  updateTime: string | null;
  visibilityStatus: string;
}

interface TopicRow {
  topicId: string;
  name: string | null;
}

interface AnnouncementRow {
  announcementId: string;
  text: string | null;
  state: string | null;
  alternateLink: string | null;
  creationTime: string | null;
  updateTime: string | null;
}

interface CourseWorkRow {
  courseWorkId: string;
  title: string | null;
  description: string | null;
  workType: string | null;
  state: string | null;
  alternateLink: string | null;
  topicId: string | null;
  updateTime: string | null;
  rawJson: string;
}

interface CourseWorkMaterialRow {
  courseWorkMaterialId: string;
  title: string | null;
  description: string | null;
  state: string | null;
  alternateLink: string | null;
  topicId: string | null;
  updateTime: string | null;
  rawJson: string;
}

interface StudentSubmissionRow {
  submissionId: string;
  state: string | null;
  late: number | null;
  updateTime: string | null;
  assignedGrade: number | null;
  draftGrade: number | null;
  shortAnswer: string | null;
  multipleChoiceAnswer: string | null;
  alternateLink: string | null;
  rawJson: string;
}

interface DriveFileRefRow {
  sourceType: string;
  attachmentType: string;
  driveFileId: string | null;
  templateDriveFileId: string | null;
  submissionDriveFileId: string | null;
  shareMode: string | null;
  materializationState: string;
  linkUrl: string | null;
  rawJson: string;
}

interface DriveFileRow {
  driveFileId: string;
  name: string | null;
  mimeType: string | null;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
}

interface DriveArtifactRow {
  artifactKind: "blob" | "export";
  outputMimeType: string;
  relativePath: string;
  status: string;
  sizeBytes: number | null;
}

const DEFAULT_NO_TOPIC_LABEL = "No topic";

function parseJson(rawJson: string | null): RawJsonRecord {
  if (!rawJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as RawJsonRecord) : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function createBannerColor(seed: string): string {
  const palette = ["#0f766e", "#1d4ed8", "#7c3aed", "#be185d", "#c2410c", "#15803d"];
  const total = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[total % palette.length] || "#0f766e";
}

function compareByTimeDesc(left: string | null, right: string | null): number {
  const leftValue = left ? Date.parse(left) : 0;
  const rightValue = right ? Date.parse(right) : 0;
  return rightValue - leftValue;
}

function createNotice(code: string): ViewerStateNotice | null {
  switch (code) {
    case "pending_materialization":
      return {
        code,
        tone: "warning",
        title: "Waiting for materialization",
        description: "A student copy has not been captured in this backup yet.",
      };
    case "failed":
      return {
        code,
        tone: "error",
        title: "Artifact unavailable",
        description: "The backup recorded this file, but a local artifact could not be saved.",
      };
    case "unsupported":
      return {
        code,
        tone: "info",
        title: "Not available from the API",
        description: "Google Classroom does not expose this data through the public API used by the backup.",
      };
    case "unavailable":
      return {
        code,
        tone: "info",
        title: "External attachment",
        description: "This item links to external content and has no local Drive artifact.",
      };
    default:
      return null;
  }
}

function uniqueNotices(codes: Array<string | null | undefined>): ViewerStateNotice[] {
  const notices: ViewerStateNotice[] = [];
  const seen = new Set<string>();

  for (const code of codes) {
    if (!code || seen.has(code)) {
      continue;
    }

    const notice = createNotice(code);
    if (notice) {
      notices.push(notice);
      seen.add(code);
    }
  }

  return notices;
}

function decodeRelativePath(value: string): string {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

function canOpenInline(mimeType: string | null): boolean {
  return Boolean(mimeType && (mimeType.startsWith("image/") || mimeType.startsWith("text/") || mimeType === "application/pdf"));
}

export class ViewerReadModel {
  constructor(private readonly db: Database.Database) {}

  listCourses(): ViewerCourseListResponse {
    const rows = this.db
      .prepare(
        `SELECT course_id AS courseId, name, section, room, course_state AS courseState,
                alternate_link AS alternateLink, update_time AS updateTime
         FROM courses
         WHERE visibility_status = 'visible'
         ORDER BY COALESCE(update_time, creation_time) DESC, course_id ASC`,
      )
      .all() as Array<Omit<CourseRow, "descriptionHeading" | "description" | "visibilityStatus">>;

    return {
      courses: rows.map((row) => this.mapCourseCard(row)),
    };
  }

  getCourse(courseId: string): ViewerCourseDetail | null {
    const row = this.db
      .prepare(
        `SELECT course_id AS courseId, name, section, room, description_heading AS descriptionHeading,
                description, course_state AS courseState, alternate_link AS alternateLink,
                update_time AS updateTime, visibility_status AS visibilityStatus
         FROM courses WHERE course_id = ?`,
      )
      .get(courseId) as CourseRow | undefined;

    if (!row) {
      return null;
    }

    return {
      courseId: row.courseId,
      name: row.name ?? row.courseId,
      section: row.section,
      room: row.room,
      descriptionHeading: row.descriptionHeading,
      description: row.description,
      alternateLink: row.alternateLink,
      courseState: row.courseState,
      updateTime: row.updateTime,
      bannerColor: createBannerColor(row.courseId),
      notices: row.visibilityStatus === "visible" ? [] : uniqueNotices([row.visibilityStatus]),
    };
  }

  getCourseStream(courseId: string): ViewerStreamResponse | null {
    if (!this.getCourse(courseId)) {
      return null;
    }

    const announcements = this.db
      .prepare(
        `SELECT announcement_id AS announcementId, text, state, alternate_link AS alternateLink,
                creation_time AS creationTime, update_time AS updateTime
         FROM announcements WHERE course_id = ?`,
      )
      .all(courseId) as AnnouncementRow[];

    const courseWork = this.db
      .prepare(
        `SELECT course_work_id AS courseWorkId, title, description, work_type AS workType, state,
                alternate_link AS alternateLink, topic_id AS topicId, update_time AS updateTime, raw_json AS rawJson
         FROM course_work WHERE course_id = ?`,
      )
      .all(courseId) as CourseWorkRow[];

    const topicsById = this.getTopicsById(courseId);
    const items: ViewerStreamItem[] = [
      ...announcements.map((row) => ({
        itemType: "announcement" as const,
        id: row.announcementId,
        title: row.text?.split("\n")[0]?.trim() || "Announcement",
        body: row.text,
        topicName: null,
        alternateLink: row.alternateLink,
        state: row.state,
        workType: null,
        createdTime: row.creationTime,
        updateTime: row.updateTime,
        detailPath: null,
      })),
      ...courseWork.map((row) => ({
        itemType: "course_work" as const,
        id: row.courseWorkId,
        title: row.title ?? "Untitled work",
        body: row.description,
        topicName: row.topicId ? (topicsById.get(row.topicId) ?? DEFAULT_NO_TOPIC_LABEL) : null,
        alternateLink: row.alternateLink,
        state: row.state,
        workType: row.workType,
        createdTime: asString(parseJson(row.rawJson).creationTime),
        updateTime: row.updateTime,
        detailPath: `/courses/${encodeURIComponent(courseId)}/course-work/${encodeURIComponent(row.courseWorkId)}`,
      })),
    ].sort((left, right) => compareByTimeDesc(left.updateTime ?? left.createdTime, right.updateTime ?? right.createdTime));

    return { courseId, items };
  }

  getCourseClasswork(courseId: string): ViewerClassworkResponse | null {
    if (!this.getCourse(courseId)) {
      return null;
    }

    const topics = this.db
      .prepare(`SELECT topic_id AS topicId, name FROM topics WHERE course_id = ? ORDER BY COALESCE(update_time, '') ASC, topic_id ASC`)
      .all(courseId) as TopicRow[];
    const topicOrder = topics.map((topic) => topic.topicId);
    const topicsById = new Map(topics.map((topic) => [topic.topicId, topic.name ?? DEFAULT_NO_TOPIC_LABEL]));

    const workItems = this.db
      .prepare(
        `SELECT course_work_id AS courseWorkId, title, description, work_type AS workType, state,
                topic_id AS topicId, update_time AS updateTime
         FROM course_work WHERE course_id = ?`,
      )
      .all(courseId) as Array<Omit<CourseWorkRow, "alternateLink" | "rawJson">>;
    const materialItems = this.db
      .prepare(
        `SELECT course_work_material_id AS courseWorkMaterialId, title, description, state,
                topic_id AS topicId, update_time AS updateTime
         FROM course_work_materials WHERE course_id = ?`,
      )
      .all(courseId) as Array<Omit<CourseWorkMaterialRow, "alternateLink" | "rawJson">>;

    const grouped = new Map<string | null, ViewerClassworkResponse["sections"][number]>();
    const ensureSection = (topicId: string | null) => {
      const existing = grouped.get(topicId);
      if (existing) {
        return existing;
      }

      const created = {
        topicId,
        topicName: topicId ? (topicsById.get(topicId) ?? DEFAULT_NO_TOPIC_LABEL) : DEFAULT_NO_TOPIC_LABEL,
        items: [],
      };
      grouped.set(topicId, created);
      return created;
    };

    for (const row of workItems) {
      ensureSection(row.topicId).items.push({
        itemType: "course_work",
        id: row.courseWorkId,
        title: row.title ?? "Untitled work",
        description: row.description,
        state: row.state,
        workType: row.workType,
        topicId: row.topicId,
        topicName: row.topicId ? (topicsById.get(row.topicId) ?? DEFAULT_NO_TOPIC_LABEL) : DEFAULT_NO_TOPIC_LABEL,
        updateTime: row.updateTime,
        detailPath: `/courses/${encodeURIComponent(courseId)}/course-work/${encodeURIComponent(row.courseWorkId)}`,
      });
    }

    for (const row of materialItems) {
      ensureSection(row.topicId).items.push({
        itemType: "course_work_material",
        id: row.courseWorkMaterialId,
        title: row.title ?? "Untitled material",
        description: row.description,
        state: row.state,
        workType: null,
        topicId: row.topicId,
        topicName: row.topicId ? (topicsById.get(row.topicId) ?? DEFAULT_NO_TOPIC_LABEL) : DEFAULT_NO_TOPIC_LABEL,
        updateTime: row.updateTime,
        detailPath: `/courses/${encodeURIComponent(courseId)}/course-work-materials/${encodeURIComponent(row.courseWorkMaterialId)}`,
      });
    }

    const orderedSections = [
      ...topicOrder.map((topicId) => grouped.get(topicId)).filter((section): section is NonNullable<typeof section> => Boolean(section)),
      ...(grouped.has(null) ? [grouped.get(null)] : []).filter((section): section is NonNullable<typeof section> => Boolean(section)),
    ].map((section) => ({
      ...section,
      items: [...section.items].sort((left, right) => compareByTimeDesc(left.updateTime, right.updateTime)),
    }));

    return { courseId, sections: orderedSections };
  }

  getCourseWorkDetail(courseId: string, courseWorkId: string): ViewerCourseWorkDetail | null {
    const row = this.db
      .prepare(
        `SELECT course_work_id AS courseWorkId, title, description, work_type AS workType, state,
                alternate_link AS alternateLink, topic_id AS topicId, update_time AS updateTime, raw_json AS rawJson
         FROM course_work WHERE course_id = ? AND course_work_id = ?`,
      )
      .get(courseId, courseWorkId) as CourseWorkRow | undefined;

    if (!row) {
      return null;
    }

    const submission = this.db
      .prepare(
        `SELECT submission_id AS submissionId, state, late, update_time AS updateTime, assigned_grade AS assignedGrade,
                draft_grade AS draftGrade, short_answer AS shortAnswer, multiple_choice_answer AS multipleChoiceAnswer,
                alternate_link AS alternateLink, raw_json AS rawJson
         FROM student_submissions
         WHERE course_id = ? AND course_work_id = ?
         ORDER BY COALESCE(update_time, creation_time) DESC, submission_id ASC
         LIMIT 1`,
      )
      .get(courseId, courseWorkId) as StudentSubmissionRow | undefined;

    const submissionAttachments = submission ? this.getAttachments(courseId, { courseWorkId, submissionId: submission.submissionId }) : [];
    const attachments = this.getAttachments(courseId, { courseWorkId });
    const topicName = row.topicId ? (this.getTopicsById(courseId).get(row.topicId) ?? DEFAULT_NO_TOPIC_LABEL) : null;

    return {
      courseId,
      courseWorkId,
      title: row.title ?? "Untitled work",
      description: row.description,
      workType: row.workType,
      state: row.state,
      topicId: row.topicId,
      topicName,
      updateTime: row.updateTime,
      alternateLink: row.alternateLink,
      attachments,
      submission: submission
        ? {
            submissionId: submission.submissionId,
            state: submission.state,
            late: submission.late === null ? null : Boolean(submission.late),
            updateTime: submission.updateTime,
            assignedGrade: submission.assignedGrade,
            draftGrade: submission.draftGrade,
            shortAnswer: submission.shortAnswer ?? asString(parseJson(submission.rawJson).shortAnswerSubmission),
            multipleChoiceAnswer: submission.multipleChoiceAnswer,
            alternateLink: submission.alternateLink,
            attachments: submissionAttachments,
            notices: uniqueNotices(submissionAttachments.flatMap((attachment) => attachment.notices.map((notice) => notice.code))),
          }
        : null,
      notices: uniqueNotices([
        row.state === "DELETED" ? "unsupported" : null,
        ...attachments.flatMap((attachment) => attachment.notices.map((notice) => notice.code)),
        ...((submission?.state ? [submission.state === "RECLAIMED_BY_STUDENT" ? "pending_materialization" : null] : []) as Array<string | null>),
      ]),
    };
  }

  getCourseWorkMaterialDetail(courseId: string, courseWorkMaterialId: string): ViewerCourseWorkMaterialDetail | null {
    const row = this.db
      .prepare(
        `SELECT course_work_material_id AS courseWorkMaterialId, title, description, state,
                alternate_link AS alternateLink, topic_id AS topicId, update_time AS updateTime, raw_json AS rawJson
         FROM course_work_materials WHERE course_id = ? AND course_work_material_id = ?`,
      )
      .get(courseId, courseWorkMaterialId) as CourseWorkMaterialRow | undefined;

    if (!row) {
      return null;
    }

    const attachments = this.getAttachments(courseId, { courseWorkMaterialId });
    const topicName = row.topicId ? (this.getTopicsById(courseId).get(row.topicId) ?? DEFAULT_NO_TOPIC_LABEL) : null;

    return {
      courseId,
      courseWorkMaterialId,
      title: row.title ?? "Untitled material",
      description: row.description,
      state: row.state,
      topicId: row.topicId,
      topicName,
      updateTime: row.updateTime,
      alternateLink: row.alternateLink,
      attachments,
      notices: uniqueNotices(attachments.flatMap((attachment) => attachment.notices.map((notice) => notice.code))),
    };
  }

  getDriveFile(driveFileId: string): ViewerDriveFile | null {
    const file = this.db
      .prepare(
        `SELECT drive_file_id AS driveFileId, name, mime_type AS mimeType, size, modified_time AS modifiedTime, web_view_link AS webViewLink
         FROM drive_files WHERE drive_file_id = ?`,
      )
      .get(driveFileId) as DriveFileRow | undefined;
    const refs = this.db
      .prepare(
        `SELECT source_type AS sourceType, attachment_type AS attachmentType, drive_file_id AS driveFileId,
                template_drive_file_id AS templateDriveFileId, submission_drive_file_id AS submissionDriveFileId,
                share_mode AS shareMode, materialization_state AS materializationState, link_url AS linkUrl, raw_json AS rawJson
         FROM drive_file_refs WHERE drive_file_id = ? OR template_drive_file_id = ? OR submission_drive_file_id = ?`,
      )
      .all(driveFileId, driveFileId, driveFileId) as DriveFileRefRow[];

    if (!file && refs.length === 0) {
      return null;
    }

    const artifacts = this.db
      .prepare(
        `SELECT artifact_kind AS artifactKind, output_mime_type AS outputMimeType, relative_path AS relativePath,
                status, size_bytes AS sizeBytes
         FROM drive_file_artifacts WHERE drive_file_id = ? ORDER BY artifact_kind ASC, relative_path ASC`,
      )
      .all(driveFileId) as DriveArtifactRow[];

    return {
      driveFileId,
      name: file?.name ?? driveFileId,
      mimeType: file?.mimeType ?? null,
      size: file?.size ?? null,
      modifiedTime: file?.modifiedTime ?? null,
      webViewLink: file?.webViewLink ?? null,
      artifacts: artifacts.map((artifact) => ({
        artifactKind: artifact.artifactKind,
        outputMimeType: artifact.outputMimeType || null,
        relativePath: artifact.relativePath,
        status: artifact.status,
        sizeBytes: artifact.sizeBytes,
        url: artifact.status === "saved" ? `/api/artifacts/${artifact.relativePath.split("/").map(encodeURIComponent).join("/")}` : null,
        label: artifact.artifactKind === "blob" ? "Original file" : `Export${artifact.outputMimeType ? ` (${artifact.outputMimeType})` : ""}`,
        openInNewTab: canOpenInline(artifact.outputMimeType || file?.mimeType || null),
      })),
      notices: uniqueNotices([
        ...refs.map((ref) => ref.materializationState),
        ...artifacts.filter((artifact) => artifact.status !== "saved").map((artifact) => artifact.status),
      ]),
    };
  }

  private mapCourseCard(row: Omit<CourseRow, "descriptionHeading" | "description" | "visibilityStatus">): ViewerCourseCard {
    return {
      courseId: row.courseId,
      name: row.name ?? row.courseId,
      section: row.section,
      room: row.room,
      courseState: row.courseState,
      alternateLink: row.alternateLink,
      updateTime: row.updateTime,
      bannerColor: createBannerColor(row.courseId),
    };
  }

  private getTopicsById(courseId: string): Map<string, string> {
    const topics = this.db.prepare(`SELECT topic_id AS topicId, name FROM topics WHERE course_id = ?`).all(courseId) as TopicRow[];
    return new Map(topics.map((topic) => [topic.topicId, topic.name ?? DEFAULT_NO_TOPIC_LABEL]));
  }

  private getAttachments(
    courseId: string,
    filters: { courseWorkId?: string; courseWorkMaterialId?: string; submissionId?: string },
  ): ViewerAttachment[] {
    const clauses = ["course_id = @courseId"];
    const params: Record<string, string | null> = { courseId };

    if (filters.courseWorkId !== undefined) {
      clauses.push("course_work_id IS @courseWorkId");
      params.courseWorkId = filters.courseWorkId;
    }

    if (filters.courseWorkMaterialId !== undefined) {
      clauses.push("course_work_material_id IS @courseWorkMaterialId");
      params.courseWorkMaterialId = filters.courseWorkMaterialId;
    }

    if (filters.submissionId !== undefined) {
      clauses.push("submission_id IS @submissionId");
      params.submissionId = filters.submissionId;
    }

    const rows = this.db
      .prepare(
        `SELECT source_type AS sourceType, attachment_type AS attachmentType, drive_file_id AS driveFileId,
                template_drive_file_id AS templateDriveFileId, submission_drive_file_id AS submissionDriveFileId,
                share_mode AS shareMode, materialization_state AS materializationState, link_url AS linkUrl, raw_json AS rawJson
         FROM drive_file_refs WHERE ${clauses.join(" AND ")}`,
      )
      .all(params) as DriveFileRefRow[];

    return rows.map((row) => {
      const rawJson = parseJson(row.rawJson);
      const title =
        asString(rawJson.title) ??
        asString((rawJson.driveFile as RawJsonRecord | undefined)?.title) ??
        asString((rawJson.driveFile as RawJsonRecord | undefined)?.driveFile && ((rawJson.driveFile as RawJsonRecord).driveFile as RawJsonRecord).title) ??
        row.driveFileId ??
        row.linkUrl ??
        "Attachment";
      const effectiveDriveFileId = row.driveFileId ?? row.submissionDriveFileId ?? row.templateDriveFileId;
      return {
        sourceType: row.sourceType,
        attachmentType: row.attachmentType,
        title,
        linkUrl: row.linkUrl,
        materializationState: row.materializationState,
        driveFileId: effectiveDriveFileId,
        driveFile: effectiveDriveFileId ? this.getDriveFile(effectiveDriveFileId) : null,
        notices: uniqueNotices([row.materializationState]),
      };
    });
  }
}
