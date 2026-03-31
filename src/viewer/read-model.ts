import type Database from "better-sqlite3";

import type {
  ViewerAttachment,
  ViewerClassworkResponse,
  ViewerCourseCard,
  ViewerCourseDetail,
  ViewerCoursePeopleResponse,
  ViewerCourseListResponse,
  ViewerCourseWorkDetail,
  ViewerCourseWorkMaterialDetail,
  ViewerDriveComment,
  ViewerDriveCommentReply,
  ViewerDriveFile,
  ViewerGradingPeriod,
  ViewerGuardian,
  ViewerGuardianInvitation,
  ViewerInvitation,
  ViewerPerson,
  ViewerRubric,
  ViewerRubricCriterion,
  ViewerRubricLevel,
  ViewerStateNotice,
  ViewerStudentGroup,
  ViewerSubmissionHistoryEntry,
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
  announcementId: string | null;
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
  artifactId: number;
  artifactKind: "blob" | "export";
  outputMimeType: string;
  downloadName: string;
  status: string;
  sizeBytes: number | null;
}

interface UserProfileRow {
  userId: string;
  fullName: string | null;
  email: string | null;
  photoUrl: string | null;
}

interface PersonRow extends UserProfileRow {
  profileName: string | null;
  profilePhotoUrl: string | null;
}

interface InvitationRow {
  invitationId: string;
  userId: string | null;
  role: string | null;
  name: string | null;
  email: string | null;
}

interface StudentGroupRow {
  studentGroupId: string;
  title: string | null;
}

interface StudentGroupMemberRow {
  studentGroupId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  photoUrl: string | null;
  profileName: string | null;
  profilePhotoUrl: string | null;
}

interface GuardianRow {
  guardianId: string;
  guardianName: string | null;
  invitedEmailAddress: string | null;
}

interface GuardianInvitationRow {
  invitationId: string;
  invitedEmailAddress: string | null;
  state: string | null;
}

interface DriveCommentRow {
  commentId: string;
  content: string | null;
  authorDisplayName: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
  resolved: number | null;
  deleted: number | null;
  quotedFileContentValue: string | null;
  repliesJson: string;
}

const DEFAULT_NO_TOPIC_LABEL = "トピックなし";

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

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getRecord(value: unknown): RawJsonRecord {
  return typeof value === "object" && value !== null ? (value as RawJsonRecord) : {};
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

function formatStructuredDate(rawJson: RawJsonRecord): string | null {
  const year = asNumber(rawJson.year);
  const month = asNumber(rawJson.month);
  const day = asNumber(rawJson.day);

  if (year === null || month === null || day === null) {
    return null;
  }

  return new Date(year, month - 1, day).toLocaleDateString();
}

function formatDueLabel(rawJson: RawJsonRecord): string | null {
  const dueDate = getRecord(rawJson.dueDate);
  const year = asNumber(dueDate.year);
  const month = asNumber(dueDate.month);
  const day = asNumber(dueDate.day);

  if (year === null || month === null || day === null) {
    return null;
  }

  const dueTime = getRecord(rawJson.dueTime);
  const hours = asNumber(dueTime.hours);
  const minutes = asNumber(dueTime.minutes);
  const date = new Date(year, month - 1, day, hours ?? 23, minutes ?? 59);
  return `提出期限: ${date.toLocaleDateString()}${hours !== null || minutes !== null ? ` ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`;
}

function formatPointsLabel(rawJson: RawJsonRecord): string | null {
  const maxPoints = asNumber(rawJson.maxPoints);
  return maxPoints === null ? null : `${maxPoints} 点`;
}

function getCreatorName(rawJson: RawJsonRecord): string | null {
  return asString(getRecord(rawJson.creatorUserProfile).name) ?? asString(rawJson.creatorUserId);
}

function createNotice(code: string): ViewerStateNotice | null {
  switch (code) {
    case "pending_materialization":
        return {
          code,
          tone: "warning",
          title: "実体化待ち",
          description: "生徒ごとのコピーがまだバックアップに保存されていません。",
        };
    case "failed":
        return {
          code,
          tone: "error",
          title: "ローカルファイル未保存",
          description: "バックアップには記録されていますが、ローカルファイルは保存されていません。",
        };
    case "unsupported":
        return {
          code,
          tone: "info",
          title: "API では取得不可",
          description: "この情報は Google Classroom API から取得できません。",
        };
    case "permission_denied":
        return {
          code,
          tone: "warning",
          title: "権限不足",
          description: "このコースの一部データは権限不足のため取得できませんでした。",
        };
    case "not_returned":
        return {
          code,
          tone: "info",
          title: "現在は非表示",
          description: "このコースは今回の同期で Classroom から返されませんでした。",
        };
    case "unavailable":
        return {
          code,
          tone: "info",
          title: "外部リンク",
          description: "この項目は外部コンテンツへのリンクで、ローカルの Drive ファイルはありません。",
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

function canOpenInline(mimeType: string | null): boolean {
  return Boolean(mimeType && (mimeType.startsWith("image/") || mimeType.startsWith("text/") || mimeType === "application/pdf"));
}

export class ViewerReadModel {
  private readonly hasAnnouncementIdColumn: boolean;
  private readonly availableTables: Set<string>;

  constructor(private readonly db: Database.Database) {
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    this.availableTables = new Set(tables.map((table) => table.name));
    const driveFileRefsColumns = this.db.prepare("PRAGMA table_info(drive_file_refs)").all() as Array<{ name: string }>;
    this.hasAnnouncementIdColumn = driveFileRefsColumns.some((column) => column.name === "announcement_id");
  }

  private hasTable(tableName: string): boolean {
    return this.availableTables.has(tableName);
  }

  private getDriveFileRefAnnouncementSelect(): string {
    return this.hasAnnouncementIdColumn ? "announcement_id AS announcementId," : "NULL AS announcementId,";
  }

  private getAnnouncementAttachments(courseId: string, announcementId: string, rawJson: string | null | undefined): ViewerAttachment[] {
    if (this.hasAnnouncementIdColumn) {
      return this.getAttachments(courseId, { announcementId });
    }

    return asArray(parseJson(rawJson ?? null).materials)
      .map((material) => this.mapLegacyAnnouncementAttachment(material))
      .filter((attachment): attachment is ViewerAttachment => Boolean(attachment));
  }

  private mapLegacyAnnouncementAttachment(material: unknown): ViewerAttachment | null {
    const record = getRecord(material);
    const driveFile = getRecord(record.driveFile);
    const driveFileMeta = getRecord(driveFile.driveFile);
    const driveFileId = asString(driveFileMeta.id);

    if (driveFileId) {
      const shareMode = asString(driveFile.shareMode);
      const materializationState = shareMode === "STUDENT_COPY" ? "pending_materialization" : "ready";
      return {
        sourceType: "course_material",
        attachmentType: "drive_file",
        title: asString(driveFileMeta.title) ?? driveFileId,
        linkUrl: asString(driveFileMeta.alternateLink),
        materializationState,
        driveFileId,
        driveFile: this.getDriveFile(driveFileId),
        notices: uniqueNotices([materializationState]),
      };
    }

    const linkUrl =
      asString(getRecord(record.link).url) ??
      asString(getRecord(record.youtubeVideo).alternateLink) ??
      asString(getRecord(record.form).formUrl);

    if (!linkUrl) {
      return null;
    }

    let attachmentType = "link";
    if (asString(getRecord(record.youtubeVideo).alternateLink)) {
      attachmentType = "youtube";
    } else if (asString(getRecord(record.form).formUrl)) {
      attachmentType = "form";
    }

    return {
      sourceType: "course_material",
      attachmentType,
      title: linkUrl,
      linkUrl,
      materializationState: "unavailable",
      driveFileId: null,
      driveFile: null,
      notices: uniqueNotices(["unavailable"]),
    };
  }

  private mapPerson(row: PersonRow | StudentGroupMemberRow): ViewerPerson {
    return {
      userId: row.userId,
      name: row.fullName ?? row.profileName ?? row.userId,
      email: row.email,
      photoUrl: row.photoUrl ?? row.profilePhotoUrl,
    };
  }

  private getUserDisplayName(userId: string | null): string | null {
    if (!userId || !this.hasTable("user_profiles")) {
      return userId;
    }

    const row = this.db
      .prepare(`SELECT user_id AS userId, full_name AS fullName, email, photo_url AS photoUrl FROM user_profiles WHERE user_id = ?`)
      .get(userId) as UserProfileRow | undefined;

    return row?.fullName ?? row?.email ?? userId;
  }

  private getCourseAliases(courseId: string): string[] {
    if (!this.hasTable("course_aliases")) {
      return [];
    }

    return (this.db.prepare(`SELECT alias FROM course_aliases WHERE course_id = ? ORDER BY alias ASC`).all(courseId) as Array<{ alias: string }>).map(
      (row) => row.alias,
    );
  }

  private getGradingPeriods(courseId: string): ViewerGradingPeriod[] {
    if (!this.hasTable("course_grading_period_settings")) {
      return [];
    }

    const row = this.db
      .prepare(`SELECT raw_json AS rawJson FROM course_grading_period_settings WHERE course_id = ?`)
      .get(courseId) as { rawJson: string } | undefined;

    if (!row) {
      return [];
    }

    return asArray(parseJson(row.rawJson).gradingPeriods)
      .map((item) => {
        const record = getRecord(item);
        const title = asString(record.title) ?? asString(record.displayName) ?? "学期";
        return {
          title,
          startDate: formatStructuredDate(getRecord(record.startDate)),
          endDate: formatStructuredDate(getRecord(record.endDate)),
        };
      })
      .filter((item) => item.title || item.startDate || item.endDate);
  }

  getCoursePeople(courseId: string): ViewerCoursePeopleResponse | null {
    if (!this.getCourse(courseId)) {
      return null;
    }

    const teachers = this.hasTable("teachers")
      ? (this.db
          .prepare(
            `SELECT t.user_id AS userId, up.full_name AS fullName, up.email, up.photo_url AS photoUrl,
                    t.profile_name AS profileName, t.profile_photo_url AS profilePhotoUrl
             FROM teachers t
             LEFT JOIN user_profiles up ON up.user_id = t.user_id
             WHERE t.course_id = ?
             ORDER BY COALESCE(up.full_name, t.profile_name, t.user_id) COLLATE NOCASE ASC, t.user_id ASC`,
          )
          .all(courseId) as PersonRow[])
      : [];

    const students = this.hasTable("students")
      ? (this.db
          .prepare(
            `SELECT s.user_id AS userId, up.full_name AS fullName, up.email, up.photo_url AS photoUrl,
                    s.profile_name AS profileName, s.profile_photo_url AS profilePhotoUrl
             FROM students s
             LEFT JOIN user_profiles up ON up.user_id = s.user_id
             WHERE s.course_id = ?
             ORDER BY COALESCE(up.full_name, s.profile_name, s.user_id) COLLATE NOCASE ASC, s.user_id ASC`,
          )
          .all(courseId) as PersonRow[])
      : [];

    const invitations = this.hasTable("invitations")
      ? (this.db
          .prepare(
            `SELECT i.invitation_id AS invitationId, i.user_id AS userId, i.role,
                    up.full_name AS name, up.email AS email
             FROM invitations i
             LEFT JOIN user_profiles up ON up.user_id = i.user_id
             WHERE i.course_id = ?
             ORDER BY COALESCE(up.full_name, i.user_id, i.invitation_id) COLLATE NOCASE ASC, i.invitation_id ASC`,
          )
          .all(courseId) as InvitationRow[])
      : [];

    const groups = this.hasTable("student_groups")
      ? (this.db
          .prepare(`SELECT student_group_id AS studentGroupId, title FROM student_groups WHERE course_id = ? ORDER BY COALESCE(title, student_group_id) COLLATE NOCASE ASC`)
          .all(courseId) as StudentGroupRow[])
      : [];

    const groupMembers = this.hasTable("student_group_members")
      ? (this.db
          .prepare(
            `SELECT gm.student_group_id AS studentGroupId, gm.user_id AS userId, up.full_name AS fullName,
                    up.email, up.photo_url AS photoUrl, s.profile_name AS profileName, s.profile_photo_url AS profilePhotoUrl
             FROM student_group_members gm
             LEFT JOIN user_profiles up ON up.user_id = gm.user_id
             LEFT JOIN students s ON s.course_id = gm.course_id AND s.user_id = gm.user_id
             WHERE gm.course_id = ?
             ORDER BY gm.student_group_id ASC, COALESCE(up.full_name, s.profile_name, gm.user_id) COLLATE NOCASE ASC`,
          )
          .all(courseId) as StudentGroupMemberRow[])
      : [];

    const guardians = this.hasTable("guardians")
      ? (this.db
          .prepare(`SELECT guardian_id AS guardianId, guardian_name AS guardianName, invited_email_address AS invitedEmailAddress FROM guardians ORDER BY COALESCE(guardian_name, guardian_id) COLLATE NOCASE ASC`)
          .all() as GuardianRow[])
      : [];

    const guardianInvitations = this.hasTable("guardian_invitations")
      ? (this.db
          .prepare(
            `SELECT invitation_id AS invitationId, invited_email_address AS invitedEmailAddress, state
             FROM guardian_invitations
             ORDER BY invitation_id ASC`,
          )
          .all() as GuardianInvitationRow[])
      : [];

    const membersByGroupId = new Map<string, ViewerPerson[]>();
    for (const member of groupMembers) {
      const list = membersByGroupId.get(member.studentGroupId) ?? [];
      list.push(this.mapPerson(member));
      membersByGroupId.set(member.studentGroupId, list);
    }

    return {
      courseId,
      teachers: teachers.map((row) => this.mapPerson(row)),
      students: students.map((row) => this.mapPerson(row)),
      invitations: invitations.map((row): ViewerInvitation => ({
        invitationId: row.invitationId,
        userId: row.userId,
        name: row.name ?? row.userId ?? row.invitationId,
        email: row.email,
        role: row.role,
      })),
      studentGroups: groups.map(
        (group): ViewerStudentGroup => ({
          studentGroupId: group.studentGroupId,
          title: group.title ?? group.studentGroupId,
          members: membersByGroupId.get(group.studentGroupId) ?? [],
        }),
      ),
      guardians: guardians.map(
        (guardian): ViewerGuardian => ({
          guardianId: guardian.guardianId,
          guardianName: guardian.guardianName ?? guardian.guardianId,
          invitedEmailAddress: guardian.invitedEmailAddress,
        }),
      ),
      guardianInvitations: guardianInvitations.map(
        (invitation): ViewerGuardianInvitation => ({
          invitationId: invitation.invitationId,
          invitedEmailAddress: invitation.invitedEmailAddress,
          state: invitation.state,
        }),
      ),
    };
  }

  private getRubrics(courseId: string, courseWorkId: string): ViewerRubric[] {
    if (!this.hasTable("rubrics")) {
      return [];
    }

    const rows = this.db
      .prepare(`SELECT rubric_id AS rubricId, title, raw_json AS rawJson FROM rubrics WHERE course_id = ? AND course_work_id = ? ORDER BY rubric_id ASC`)
      .all(courseId, courseWorkId) as Array<{ rubricId: string; title: string | null; rawJson: string }>;

    return rows.map((row) => {
      const rawJson = parseJson(row.rawJson);
      const criteria = asArray(rawJson.criteria).map((item, criterionIndex): ViewerRubricCriterion => {
        const criterion = getRecord(item);
        const levels = asArray(criterion.levels).map((level, levelIndex): ViewerRubricLevel => {
          const record = getRecord(level);
          return {
            levelId: asString(record.id) ?? `${row.rubricId}-level-${criterionIndex}-${levelIndex}`,
            title: asString(record.title) ?? asString(record.description) ?? `Level ${levelIndex + 1}`,
            description: asString(record.description),
            points: asNumber(record.points),
          };
        });

        return {
          criterionId: asString(criterion.id) ?? `${row.rubricId}-criterion-${criterionIndex}`,
          title: asString(criterion.title) ?? asString(criterion.description) ?? `Criterion ${criterionIndex + 1}`,
          description: asString(criterion.description),
          levels,
        };
      });

      return {
        rubricId: row.rubricId,
        title: row.title ?? asString(rawJson.title) ?? row.rubricId,
        criteria,
      };
    });
  }

  private getSubmissionHistory(rawJson: RawJsonRecord): ViewerSubmissionHistoryEntry[] {
    return asArray(rawJson.submissionHistory)
      .map((item, index) => {
        const record = getRecord(item);
        const stateHistory = getRecord(record.stateHistory);
        if (Object.keys(stateHistory).length > 0) {
          const actorUserId = asString(stateHistory.actorUserId);
          return {
            entryId: `state-${index}`,
            title: `状態が ${asString(stateHistory.state) ?? "更新"} に変更されました`,
            description: null,
            actorName: this.getUserDisplayName(actorUserId),
            timestamp: asString(stateHistory.stateTimestamp),
          };
        }

        const gradeHistory = getRecord(record.gradeHistory);
        if (Object.keys(gradeHistory).length > 0) {
          const actorUserId = asString(gradeHistory.actorUserId);
          const details = [
            asString(gradeHistory.gradeChangeType),
            asNumber(gradeHistory.pointsEarned) !== null ? `得点 ${asNumber(gradeHistory.pointsEarned)}` : null,
            asNumber(gradeHistory.maxPoints) !== null ? `満点 ${asNumber(gradeHistory.maxPoints)}` : null,
          ].filter((value): value is string => Boolean(value));

          return {
            entryId: `grade-${index}`,
            title: "採点が更新されました",
            description: details.length > 0 ? details.join(" / ") : null,
            actorName: this.getUserDisplayName(actorUserId),
            timestamp: asString(gradeHistory.gradeTimestamp),
          };
        }

        return {
          entryId: `history-${index}`,
          title: "提出履歴",
          description: null,
          actorName: null,
          timestamp: null,
        };
      })
      .sort((left, right) => compareByTimeDesc(left.timestamp, right.timestamp));
  }

  private getDriveComments(driveFileId: string): ViewerDriveComment[] {
    if (!this.hasTable("drive_comments")) {
      return [];
    }

    const rows = this.db
      .prepare(
        `SELECT comment_id AS commentId, content, author_display_name AS authorDisplayName, created_time AS createdTime,
                modified_time AS modifiedTime, resolved, deleted, quoted_file_content_value AS quotedFileContentValue,
                replies_json AS repliesJson
         FROM drive_comments WHERE drive_file_id = ?
         ORDER BY COALESCE(modified_time, created_time) DESC, comment_id ASC`,
      )
      .all(driveFileId) as DriveCommentRow[];

    return rows.map((row): ViewerDriveComment => ({
      commentId: row.commentId,
      content: row.content,
      authorDisplayName: row.authorDisplayName,
      createdTime: row.createdTime,
      modifiedTime: row.modifiedTime,
      resolved: row.resolved === null ? null : Boolean(row.resolved),
      deleted: row.deleted === null ? null : Boolean(row.deleted),
      quotedFileContentValue: row.quotedFileContentValue,
      replies: asArray(parseJson(row.repliesJson)).map((reply, index): ViewerDriveCommentReply => {
        const record = getRecord(reply);
        return {
          replyId: asString(record.id) ?? `${row.commentId}-reply-${index}`,
          authorDisplayName: asString(getRecord(record.author).displayName),
          content: asString(record.content),
          createdTime: asString(record.createdTime),
          modifiedTime: asString(record.modifiedTime),
          deleted: asBoolean(record.deleted),
        };
      }),
    }));
  }

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
      aliases: this.getCourseAliases(row.courseId),
      gradingPeriods: this.getGradingPeriods(row.courseId),
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
                creation_time AS creationTime, update_time AS updateTime, raw_json AS rawJson
         FROM announcements WHERE course_id = ?`,
      )
      .all(courseId) as Array<AnnouncementRow & { rawJson?: string }>;

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
        authorName: getCreatorName(parseJson(row.rawJson ?? null)),
        topicName: null,
        alternateLink: row.alternateLink,
        state: row.state,
        workType: null,
        createdTime: row.creationTime,
        updateTime: row.updateTime,
        dueLabel: null,
        pointsLabel: null,
        attachments: this.getAnnouncementAttachments(courseId, row.announcementId, row.rawJson),
        detailPath: null,
      })),
      ...courseWork.map((row) => {
        const rawJson = parseJson(row.rawJson);
        return {
          itemType: "course_work" as const,
          id: row.courseWorkId,
          title: row.title ?? "Untitled work",
          body: row.description,
          authorName: getCreatorName(rawJson),
          topicName: row.topicId ? (topicsById.get(row.topicId) ?? DEFAULT_NO_TOPIC_LABEL) : null,
          alternateLink: row.alternateLink,
          state: row.state,
          workType: row.workType,
          createdTime: asString(rawJson.creationTime),
          updateTime: row.updateTime,
          dueLabel: formatDueLabel(rawJson),
          pointsLabel: formatPointsLabel(rawJson),
          attachments: this.getAttachments(courseId, { courseWorkId: row.courseWorkId }).slice(0, 4),
          detailPath: `/courses/${encodeURIComponent(courseId)}/course-work/${encodeURIComponent(row.courseWorkId)}`,
        };
      }),
    ].sort((left, right) => compareByTimeDesc(left.updateTime ?? left.createdTime, right.updateTime ?? right.createdTime));

    const upcoming = items
      .filter((item) => item.itemType === "course_work" && item.detailPath)
      .filter((item) => item.dueLabel)
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        title: item.title,
        dueLabel: item.dueLabel,
        detailPath: item.detailPath!,
      }));

    return { courseId, upcoming, items };
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

    const sectionNewestTime = (section: ViewerClassworkResponse["sections"][number]): number => {
      const newest = section.items.reduce<number>((max, item) => {
        const value = item.updateTime ? Date.parse(item.updateTime) : 0;
        return value > max ? value : max;
      }, 0);
      return Number.isFinite(newest) ? newest : 0;
    };

    const orderedSections = [
      ...topicOrder.map((topicId) => grouped.get(topicId)).filter((section): section is NonNullable<typeof section> => Boolean(section)),
      ...(grouped.has(null) ? [grouped.get(null)] : []).filter((section): section is NonNullable<typeof section> => Boolean(section)),
    ]
      .map((section) => ({
        ...section,
        items: [...section.items].sort((left, right) => compareByTimeDesc(left.updateTime, right.updateTime)),
      }))
      .sort((left, right) => sectionNewestTime(right) - sectionNewestTime(left));

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
    const rawJson = parseJson(row.rawJson);
    const submissionRawJson = parseJson(submission?.rawJson ?? null);

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
      dueLabel: formatDueLabel(rawJson),
      pointsLabel: formatPointsLabel(rawJson),
      attachments,
      rubrics: this.getRubrics(courseId, courseWorkId),
      submission: submission
        ? {
            submissionId: submission.submissionId,
            state: submission.state,
            late: submission.late === null ? null : Boolean(submission.late),
            updateTime: submission.updateTime,
            assignedGrade: submission.assignedGrade,
            draftGrade: submission.draftGrade,
            shortAnswer: submission.shortAnswer ?? asString(getRecord(submissionRawJson.shortAnswerSubmission).answer),
            multipleChoiceAnswer: submission.multipleChoiceAnswer,
            alternateLink: submission.alternateLink,
            attachments: submissionAttachments,
            history: this.getSubmissionHistory(submissionRawJson),
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
                ${this.getDriveFileRefAnnouncementSelect()}
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
        `SELECT artifact_id AS artifactId, artifact_kind AS artifactKind, output_mime_type AS outputMimeType,
                download_name AS downloadName, status, size_bytes AS sizeBytes
         FROM drive_file_artifacts WHERE drive_file_id = ? ORDER BY artifact_kind ASC, artifact_id ASC`,
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
        artifactId: artifact.artifactId,
        artifactKind: artifact.artifactKind,
        outputMimeType: artifact.outputMimeType || null,
        downloadName: artifact.downloadName,
        status: artifact.status,
        sizeBytes: artifact.sizeBytes,
        url: artifact.status === "saved" ? `/api/artifacts/${artifact.artifactId}` : null,
        label: artifact.artifactKind === "blob" ? "元ファイル" : `エクスポート${artifact.outputMimeType ? ` (${artifact.outputMimeType})` : ""}`,
        openInNewTab: canOpenInline(artifact.outputMimeType || file?.mimeType || null),
      })),
      comments: this.getDriveComments(driveFileId),
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
    filters: { announcementId?: string; courseWorkId?: string; courseWorkMaterialId?: string; submissionId?: string },
  ): ViewerAttachment[] {
    if (filters.announcementId !== undefined && !this.hasAnnouncementIdColumn) {
      return [];
    }

    const clauses = ["course_id = @courseId"];
    const params: Record<string, string | null> = { courseId };

    if (filters.announcementId !== undefined) {
      clauses.push("announcement_id IS @announcementId");
      params.announcementId = filters.announcementId;
    }

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
                ${this.getDriveFileRefAnnouncementSelect()}
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

  getArtifactContent(artifactId: number): { content: Buffer; contentType: string; downloadName: string } | null {
    const artifact = this.db
      .prepare(
        `SELECT b.content AS content, a.output_mime_type AS outputMimeType, a.download_name AS downloadName,
                f.mime_type AS driveMimeType
         FROM drive_file_artifacts a
         JOIN artifact_blobs b ON b.blob_id = a.blob_id
         LEFT JOIN drive_files f ON f.drive_file_id = a.drive_file_id
         WHERE a.artifact_id = ? AND a.status = 'saved'`,
      )
      .get(artifactId) as { content: Buffer; outputMimeType: string; downloadName: string; driveMimeType: string | null } | undefined;

    if (!artifact) {
      return null;
    }

    return {
      content: artifact.content,
      contentType: artifact.outputMimeType || artifact.driveMimeType || "application/octet-stream",
      downloadName: artifact.downloadName,
    };
  }
}
