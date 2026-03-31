export type ViewerNoticeTone = "info" | "warning" | "error";

export interface ViewerStateNotice {
  code: string;
  tone: ViewerNoticeTone;
  title: string;
  description: string;
}

export interface ViewerCourseCard {
  courseId: string;
  name: string;
  section: string | null;
  room: string | null;
  courseState: string | null;
  alternateLink: string | null;
  updateTime: string | null;
  bannerColor: string;
}

export interface ViewerCourseListResponse {
  courses: ViewerCourseCard[];
}

export interface ViewerCourseDetail {
  courseId: string;
  name: string;
  section: string | null;
  room: string | null;
  descriptionHeading: string | null;
  description: string | null;
  alternateLink: string | null;
  courseState: string | null;
  updateTime: string | null;
  bannerColor: string;
  aliases: string[];
  gradingPeriods: ViewerGradingPeriod[];
  notices: ViewerStateNotice[];
}

export interface ViewerGradingPeriod {
  title: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ViewerPerson {
  userId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
}

export interface ViewerInvitation {
  invitationId: string;
  userId: string | null;
  name: string;
  email: string | null;
  role: string | null;
}

export interface ViewerStudentGroup {
  studentGroupId: string;
  title: string;
  members: ViewerPerson[];
}

export interface ViewerGuardian {
  guardianId: string;
  guardianName: string;
  invitedEmailAddress: string | null;
}

export interface ViewerGuardianInvitation {
  invitationId: string;
  invitedEmailAddress: string | null;
  state: string | null;
}

export interface ViewerCoursePeopleResponse {
  courseId: string;
  teachers: ViewerPerson[];
  students: ViewerPerson[];
  invitations: ViewerInvitation[];
  studentGroups: ViewerStudentGroup[];
  guardians: ViewerGuardian[];
  guardianInvitations: ViewerGuardianInvitation[];
}

export interface ViewerStreamItem {
  itemType: "announcement" | "course_work";
  id: string;
  title: string;
  body: string | null;
  authorName: string | null;
  topicName: string | null;
  alternateLink: string | null;
  state: string | null;
  workType: string | null;
  createdTime: string | null;
  updateTime: string | null;
  dueLabel: string | null;
  pointsLabel: string | null;
  attachments: ViewerAttachment[];
  detailPath: string | null;
}

export interface ViewerStreamResponse {
  courseId: string;
  upcoming: Array<{
    id: string;
    title: string;
    dueLabel: string | null;
    detailPath: string;
  }>;
  items: ViewerStreamItem[];
}

export interface ViewerClassworkItem {
  itemType: "course_work" | "course_work_material";
  id: string;
  title: string;
  description: string | null;
  state: string | null;
  workType: string | null;
  topicId: string | null;
  topicName: string | null;
  updateTime: string | null;
  detailPath: string;
}

export interface ViewerClassworkSection {
  topicId: string | null;
  topicName: string;
  items: ViewerClassworkItem[];
}

export interface ViewerClassworkResponse {
  courseId: string;
  sections: ViewerClassworkSection[];
}

export interface ViewerArtifactLink {
  artifactId: number;
  artifactKind: "blob" | "export";
  outputMimeType: string | null;
  downloadName: string;
  status: string;
  sizeBytes: number | null;
  url: string | null;
  label: string;
  openInNewTab: boolean;
}

export interface ViewerDriveFile {
  driveFileId: string;
  name: string;
  mimeType: string | null;
  size: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  artifacts: ViewerArtifactLink[];
  comments: ViewerDriveComment[];
  notices: ViewerStateNotice[];
}

export interface ViewerDriveCommentReply {
  replyId: string;
  authorDisplayName: string | null;
  content: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
  deleted: boolean | null;
}

export interface ViewerDriveComment {
  commentId: string;
  content: string | null;
  authorDisplayName: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
  resolved: boolean | null;
  deleted: boolean | null;
  quotedFileContentValue: string | null;
  replies: ViewerDriveCommentReply[];
}

export interface ViewerAttachment {
  sourceType: string;
  attachmentType: string;
  title: string;
  linkUrl: string | null;
  materializationState: string;
  driveFileId: string | null;
  driveFile: ViewerDriveFile | null;
  notices: ViewerStateNotice[];
}

export interface ViewerSubmissionSummary {
  submissionId: string;
  state: string | null;
  late: boolean | null;
  updateTime: string | null;
  assignedGrade: number | null;
  draftGrade: number | null;
  shortAnswer: string | null;
  multipleChoiceAnswer: string | null;
  alternateLink: string | null;
  attachments: ViewerAttachment[];
  history: ViewerSubmissionHistoryEntry[];
  notices: ViewerStateNotice[];
}

export interface ViewerSubmissionHistoryEntry {
  entryId: string;
  title: string;
  description: string | null;
  actorName: string | null;
  timestamp: string | null;
}

export interface ViewerRubricLevel {
  levelId: string;
  title: string;
  description: string | null;
  points: number | null;
}

export interface ViewerRubricCriterion {
  criterionId: string;
  title: string;
  description: string | null;
  levels: ViewerRubricLevel[];
}

export interface ViewerRubric {
  rubricId: string;
  title: string;
  criteria: ViewerRubricCriterion[];
}

export interface ViewerCourseWorkDetail {
  courseId: string;
  courseWorkId: string;
  title: string;
  description: string | null;
  workType: string | null;
  state: string | null;
  topicId: string | null;
  topicName: string | null;
  updateTime: string | null;
  alternateLink: string | null;
  dueLabel: string | null;
  pointsLabel: string | null;
  attachments: ViewerAttachment[];
  rubrics: ViewerRubric[];
  submission: ViewerSubmissionSummary | null;
  notices: ViewerStateNotice[];
}

export interface ViewerCourseWorkMaterialDetail {
  courseId: string;
  courseWorkMaterialId: string;
  title: string;
  description: string | null;
  state: string | null;
  topicId: string | null;
  topicName: string | null;
  updateTime: string | null;
  alternateLink: string | null;
  attachments: ViewerAttachment[];
  notices: ViewerStateNotice[];
}

export interface ViewerHealthResponse {
  ok: true;
}

export interface ViewerApiErrorResponse {
  error: {
    message: string;
  };
}
