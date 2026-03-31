import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import type { classroom_v1 } from "googleapis";

import type {
  SyncableAnnouncement,
  SyncableCourse,
  SyncableCourseAlias,
  SyncableCourseGradingPeriodSettings,
  SyncableCourseWork,
  SyncableCourseWorkMaterial,
  SyncableGuardian,
  SyncableGuardianInvitation,
  SyncableInvitation,
  SyncableRubric,
  SyncableStudent,
  SyncableStudentGroup,
  SyncableStudentGroupMember,
  SyncableStudentSubmission,
  SyncableTeacher,
  SyncableTopic,
  SyncableUserProfile,
} from "../../domain/classroom-types.js";
import { withRetry } from "./retry.js";

const COURSE_STATES: classroom_v1.Params$Resource$Courses$List["courseStates"] = ["ACTIVE", "ARCHIVED", "PROVISIONED", "DECLINED"];
const PAGE_SIZE = 100;

type JsonObject = Record<string, unknown>;

export interface CourseBundle {
  course: SyncableCourse;
  aliases?: SyncableCourseAlias[];
  gradingPeriodSettings?: SyncableCourseGradingPeriodSettings | null;
  topics: SyncableTopic[];
  announcements: SyncableAnnouncement[];
  courseWork: SyncableCourseWork[];
  rubricsByCourseWorkId?: Record<string, SyncableRubric[]>;
  courseWorkMaterials: SyncableCourseWorkMaterial[];
  studentSubmissions: SyncableStudentSubmission[];
  students?: SyncableStudent[];
  teachers?: SyncableTeacher[];
  studentGroups?: SyncableStudentGroup[];
  studentGroupMembersByGroupId?: Record<string, SyncableStudentGroupMember[]>;
}

export interface ClassroomService {
  listCourses(): Promise<SyncableCourse[]>;
  getCourse(courseId: string): Promise<SyncableCourse>;
  listCourseAliases(courseId: string): Promise<SyncableCourseAlias[]>;
  getGradingPeriodSettings(courseId: string): Promise<SyncableCourseGradingPeriodSettings>;
  listTopics(courseId: string): Promise<SyncableTopic[]>;
  getTopic(courseId: string, topicId: string): Promise<SyncableTopic>;
  listAnnouncements(courseId: string): Promise<SyncableAnnouncement[]>;
  getAnnouncement(courseId: string, announcementId: string): Promise<SyncableAnnouncement>;
  listCourseWork(courseId: string): Promise<SyncableCourseWork[]>;
  getCourseWork(courseId: string, courseWorkId: string): Promise<SyncableCourseWork>;
  listRubrics(courseId: string, courseWorkId: string): Promise<SyncableRubric[]>;
  getRubric(courseId: string, courseWorkId: string, rubricId: string): Promise<SyncableRubric>;
  listCourseWorkMaterials(courseId: string): Promise<SyncableCourseWorkMaterial[]>;
  getCourseWorkMaterial(courseId: string, courseWorkMaterialId: string): Promise<SyncableCourseWorkMaterial>;
  listStudentSubmissions(courseId: string): Promise<SyncableStudentSubmission[]>;
  getStudentSubmission(courseId: string, courseWorkId: string, submissionId: string): Promise<SyncableStudentSubmission>;
  listStudents(courseId: string): Promise<SyncableStudent[]>;
  getStudent(courseId: string, userId: string): Promise<SyncableStudent>;
  listTeachers(courseId: string): Promise<SyncableTeacher[]>;
  getTeacher(courseId: string, userId: string): Promise<SyncableTeacher>;
  getUserProfile(userId: string): Promise<SyncableUserProfile>;
  listInvitations(): Promise<SyncableInvitation[]>;
  getInvitation(invitationId: string): Promise<SyncableInvitation>;
  listStudentGroups(courseId: string): Promise<SyncableStudentGroup[]>;
  listStudentGroupMembers(courseId: string, studentGroupId: string): Promise<SyncableStudentGroupMember[]>;
  listGuardians(studentId: string): Promise<SyncableGuardian[]>;
  getGuardian(studentId: string, guardianId: string): Promise<SyncableGuardian>;
  listGuardianInvitations(studentId: string): Promise<SyncableGuardianInvitation[]>;
  getGuardianInvitation(studentId: string, invitationId: string): Promise<SyncableGuardianInvitation>;
}

function getFullName(profile: classroom_v1.Schema$UserProfile | undefined | null): string | null {
  return profile?.name?.fullName ?? null;
}

function mapCourse(course: classroom_v1.Schema$Course): SyncableCourse {
  return {
    id: course.id ?? "",
    name: course.name ?? null,
    section: course.section ?? null,
    descriptionHeading: course.descriptionHeading ?? null,
    description: course.description ?? null,
    room: course.room ?? null,
    ownerId: course.ownerId ?? null,
    courseState: course.courseState ?? null,
    alternateLink: course.alternateLink ?? null,
    creationTime: course.creationTime ?? null,
    updateTime: course.updateTime ?? null,
    rawJson: course,
  };
}

function mapTopic(courseId: string, topic: classroom_v1.Schema$Topic): SyncableTopic {
  return {
    courseId,
    topicId: topic.topicId ?? "",
    name: topic.name ?? null,
    updateTime: topic.updateTime ?? null,
    rawJson: topic,
  };
}

function mapAnnouncement(courseId: string, announcement: classroom_v1.Schema$Announcement): SyncableAnnouncement {
  return {
    courseId,
    announcementId: announcement.id ?? "",
    text: announcement.text ?? null,
    state: announcement.state ?? null,
    alternateLink: announcement.alternateLink ?? null,
    creationTime: announcement.creationTime ?? null,
    updateTime: announcement.updateTime ?? null,
    materials: announcement.materials ?? [],
    rawJson: announcement,
  };
}

function mapCourseWork(courseId: string, item: classroom_v1.Schema$CourseWork): SyncableCourseWork {
  return {
    courseId,
    courseWorkId: item.id ?? "",
    title: item.title ?? null,
    description: item.description ?? null,
    workType: item.workType ?? null,
    state: item.state ?? null,
    alternateLink: item.alternateLink ?? null,
    topicId: item.topicId ?? null,
    updateTime: item.updateTime ?? null,
    materials: item.materials ?? [],
    rawJson: item,
  };
}

function mapCourseWorkMaterial(courseId: string, item: classroom_v1.Schema$CourseWorkMaterial): SyncableCourseWorkMaterial {
  return {
    courseId,
    courseWorkMaterialId: item.id ?? "",
    title: item.title ?? null,
    description: item.description ?? null,
    state: item.state ?? null,
    alternateLink: item.alternateLink ?? null,
    topicId: item.topicId ?? null,
    updateTime: item.updateTime ?? null,
    materials: item.materials ?? [],
    rawJson: item,
  };
}

function mapStudentSubmission(courseId: string, item: classroom_v1.Schema$StudentSubmission): SyncableStudentSubmission {
  return {
    courseId,
    courseWorkId: item.courseWorkId ?? "",
    submissionId: item.id ?? "",
    userId: item.userId ?? null,
    state: item.state ?? null,
    late: item.late ?? null,
    courseWorkType: item.courseWorkType ?? null,
    associatedWithDeveloper: item.associatedWithDeveloper ?? null,
    creationTime: item.creationTime ?? null,
    updateTime: item.updateTime ?? null,
    assignmentSubmission: item.assignmentSubmission ?? null,
    shortAnswerSubmission: item.shortAnswerSubmission ?? null,
    multipleChoiceSubmission: item.multipleChoiceSubmission ?? null,
    submissionHistory: item.submissionHistory ?? [],
    draftGrade: item.draftGrade ?? null,
    assignedGrade: item.assignedGrade ?? null,
    alternateLink: item.alternateLink ?? null,
    rawJson: item,
  };
}

function mapCourseAlias(courseId: string, alias: JsonObject): SyncableCourseAlias {
  return {
    courseId,
    alias: String(alias.alias ?? ""),
    rawJson: alias,
  };
}

function mapRubric(courseId: string, courseWorkId: string, rubric: JsonObject): SyncableRubric {
  return {
    courseId,
    courseWorkId,
    rubricId: String(rubric.id ?? ""),
    title: typeof rubric.title === "string" ? rubric.title : null,
    rawJson: rubric,
  };
}

function mapStudent(courseId: string, student: classroom_v1.Schema$Student): SyncableStudent {
  return {
    courseId,
    userId: student.userId ?? "",
    profileName: getFullName(student.profile),
    profilePhotoUrl: student.profile?.photoUrl ?? null,
    rawJson: student,
  };
}

function mapTeacher(courseId: string, teacher: classroom_v1.Schema$Teacher): SyncableTeacher {
  return {
    courseId,
    userId: teacher.userId ?? "",
    profileName: getFullName(teacher.profile),
    profilePhotoUrl: teacher.profile?.photoUrl ?? null,
    rawJson: teacher,
  };
}

function mapUserProfile(profile: classroom_v1.Schema$UserProfile): SyncableUserProfile {
  return {
    userId: profile.id ?? "",
    fullName: profile.name?.fullName ?? null,
    email: profile.emailAddress ?? null,
    photoUrl: profile.photoUrl ?? null,
    rawJson: profile,
  };
}

function mapInvitation(invitation: classroom_v1.Schema$Invitation): SyncableInvitation {
  return {
    invitationId: invitation.id ?? "",
    courseId: invitation.courseId ?? null,
    userId: invitation.userId ?? null,
    role: invitation.role ?? null,
    rawJson: invitation,
  };
}

function mapStudentGroup(courseId: string, group: JsonObject): SyncableStudentGroup {
  return {
    courseId,
    studentGroupId: String(group.id ?? ""),
    title: typeof group.title === "string" ? group.title : null,
    rawJson: group,
  };
}

function mapStudentGroupMember(courseId: string, studentGroupId: string, member: JsonObject): SyncableStudentGroupMember {
  return {
    courseId,
    studentGroupId,
    userId: String(member.userId ?? ""),
    rawJson: member,
  };
}

function mapGuardian(studentId: string, guardian: classroom_v1.Schema$Guardian): SyncableGuardian {
  return {
    studentId,
    guardianId: guardian.guardianId ?? "",
    guardianName: getFullName(guardian.guardianProfile),
    invitedEmailAddress: guardian.invitedEmailAddress ?? null,
    rawJson: guardian,
  };
}

function mapGuardianInvitation(studentId: string, invitation: classroom_v1.Schema$GuardianInvitation): SyncableGuardianInvitation {
  return {
    studentId,
    invitationId: invitation.invitationId ?? "",
    invitedEmailAddress: invitation.invitedEmailAddress ?? null,
    state: invitation.state ?? null,
    rawJson: invitation,
  };
}

async function listAllPages<T>(fetchPage: (pageToken?: string) => Promise<{ items: T[]; nextPageToken?: string | null }>): Promise<T[]> {
  const results: T[] = [];
  let pageToken: string | undefined;

  do {
    const response = await fetchPage(pageToken);
    results.push(...response.items);
    pageToken = response.nextPageToken ?? undefined;
  } while (pageToken);

  return results;
}

export class GoogleClassroomService implements ClassroomService {
  private readonly api: classroom_v1.Classroom;

  constructor(private readonly auth: OAuth2Client | null) {
    if (!auth) {
      throw new Error("Authorized Google client is required for Classroom API access.");
    }

    this.api = google.classroom({ version: "v1", auth });
  }

  private async requestJson<T extends JsonObject>(url: string): Promise<T> {
    const response = await withRetry(() => this.auth!.request<T>({ url, method: "GET" }));
    return (response.data ?? {}) as T;
  }

  async listCourses(): Promise<SyncableCourse[]> {
    const courses = await listAllPages(async (pageToken) => {
      const response = await withRetry(() =>
        this.api.courses.list({
          studentId: "me",
          pageSize: PAGE_SIZE,
          pageToken,
          courseStates: COURSE_STATES,
        }),
      );

      return {
        items: (response.data.courses ?? []).map(mapCourse),
        nextPageToken: response.data.nextPageToken,
      };
    });

    return courses.filter((course) => course.id);
  }

  async getCourse(courseId: string): Promise<SyncableCourse> {
    const response = await withRetry(() => this.api.courses.get({ id: courseId }));
    return mapCourse(response.data);
  }

  async listCourseAliases(courseId: string): Promise<SyncableCourseAlias[]> {
    const aliases = await listAllPages(async (pageToken) => {
      const response = await this.requestJson<{ aliases?: JsonObject[]; nextPageToken?: string | null }>(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/aliases?pageSize=${PAGE_SIZE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
      );

      return {
        items: (response.aliases ?? []).map((alias) => mapCourseAlias(courseId, alias)).filter((item) => item.alias),
        nextPageToken: response.nextPageToken,
      };
    });

    return aliases;
  }

  async getGradingPeriodSettings(courseId: string): Promise<SyncableCourseGradingPeriodSettings> {
    const response = await this.requestJson<JsonObject>(
      `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}:getGradingPeriodSettings`,
    );
    return { courseId, rawJson: response };
  }

  async listTopics(courseId: string): Promise<SyncableTopic[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.courses.topics.list({ courseId, pageSize: PAGE_SIZE, pageToken }));
      return {
        items: (response.data.topic ?? []).map((item) => mapTopic(courseId, item)).filter((item) => item.topicId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getTopic(courseId: string, topicId: string): Promise<SyncableTopic> {
    const response = await withRetry(() => this.api.courses.topics.get({ courseId, id: topicId }));
    return mapTopic(courseId, response.data);
  }

  async listAnnouncements(courseId: string): Promise<SyncableAnnouncement[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.courses.announcements.list({ courseId, pageSize: PAGE_SIZE, pageToken }));
      return {
        items: (response.data.announcements ?? []).map((item) => mapAnnouncement(courseId, item)).filter((item) => item.announcementId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getAnnouncement(courseId: string, announcementId: string): Promise<SyncableAnnouncement> {
    const response = await withRetry(() => this.api.courses.announcements.get({ courseId, id: announcementId }));
    return mapAnnouncement(courseId, response.data);
  }

  async listCourseWork(courseId: string): Promise<SyncableCourseWork[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.courses.courseWork.list({ courseId, pageSize: PAGE_SIZE, pageToken }));
      return {
        items: (response.data.courseWork ?? []).map((item) => mapCourseWork(courseId, item)).filter((item) => item.courseWorkId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getCourseWork(courseId: string, courseWorkId: string): Promise<SyncableCourseWork> {
    const response = await withRetry(() => this.api.courses.courseWork.get({ courseId, id: courseWorkId }));
    return mapCourseWork(courseId, response.data);
  }

  async listRubrics(courseId: string, courseWorkId: string): Promise<SyncableRubric[]> {
    const rubrics = await listAllPages(async (pageToken) => {
      const response = await this.requestJson<{ rubrics?: JsonObject[]; nextPageToken?: string | null }>(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/rubrics?pageSize=${PAGE_SIZE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
      );

      return {
        items: (response.rubrics ?? []).map((rubric) => mapRubric(courseId, courseWorkId, rubric)).filter((item) => item.rubricId),
        nextPageToken: response.nextPageToken,
      };
    });

    return rubrics;
  }

  async getRubric(courseId: string, courseWorkId: string, rubricId: string): Promise<SyncableRubric> {
    const response = await this.requestJson<JsonObject>(
      `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/rubrics/${encodeURIComponent(rubricId)}`,
    );
    return mapRubric(courseId, courseWorkId, response);
  }

  async listCourseWorkMaterials(courseId: string): Promise<SyncableCourseWorkMaterial[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.courses.courseWorkMaterials.list({ courseId, pageSize: PAGE_SIZE, pageToken }));
      return {
        items: (response.data.courseWorkMaterial ?? [])
          .map((item) => mapCourseWorkMaterial(courseId, item))
          .filter((item) => item.courseWorkMaterialId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getCourseWorkMaterial(courseId: string, courseWorkMaterialId: string): Promise<SyncableCourseWorkMaterial> {
    const response = await withRetry(() => this.api.courses.courseWorkMaterials.get({ courseId, id: courseWorkMaterialId }));
    return mapCourseWorkMaterial(courseId, response.data);
  }

  async listStudentSubmissions(courseId: string): Promise<SyncableStudentSubmission[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() =>
        this.api.courses.courseWork.studentSubmissions.list({ courseId, courseWorkId: "-", userId: "me", pageSize: PAGE_SIZE, pageToken }),
      );

      return {
        items: (response.data.studentSubmissions ?? [])
          .map((item) => mapStudentSubmission(courseId, item))
          .filter((item) => item.submissionId && item.courseWorkId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getStudentSubmission(courseId: string, courseWorkId: string, submissionId: string): Promise<SyncableStudentSubmission> {
    const response = await withRetry(() => this.api.courses.courseWork.studentSubmissions.get({ courseId, courseWorkId, id: submissionId }));
    return mapStudentSubmission(courseId, response.data);
  }

  async listStudents(courseId: string): Promise<SyncableStudent[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.courses.students.list({ courseId, pageSize: PAGE_SIZE, pageToken }));
      return {
        items: (response.data.students ?? []).map((item) => mapStudent(courseId, item)).filter((item) => item.userId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getStudent(courseId: string, userId: string): Promise<SyncableStudent> {
    const response = await withRetry(() => this.api.courses.students.get({ courseId, userId }));
    return mapStudent(courseId, response.data);
  }

  async listTeachers(courseId: string): Promise<SyncableTeacher[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.courses.teachers.list({ courseId, pageSize: PAGE_SIZE, pageToken }));
      return {
        items: (response.data.teachers ?? []).map((item) => mapTeacher(courseId, item)).filter((item) => item.userId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getTeacher(courseId: string, userId: string): Promise<SyncableTeacher> {
    const response = await withRetry(() => this.api.courses.teachers.get({ courseId, userId }));
    return mapTeacher(courseId, response.data);
  }

  async getUserProfile(userId: string): Promise<SyncableUserProfile> {
    const response = await withRetry(() => this.api.userProfiles.get({ userId }));
    return mapUserProfile(response.data);
  }

  async listInvitations(): Promise<SyncableInvitation[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.invitations.list({ userId: "me", pageSize: 500, pageToken }));
      return {
        items: (response.data.invitations ?? []).map(mapInvitation).filter((item) => item.invitationId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getInvitation(invitationId: string): Promise<SyncableInvitation> {
    const response = await withRetry(() => this.api.invitations.get({ id: invitationId }));
    return mapInvitation(response.data);
  }

  async listStudentGroups(courseId: string): Promise<SyncableStudentGroup[]> {
    const groups = await listAllPages(async (pageToken) => {
      const response = await this.requestJson<{ studentGroups?: JsonObject[]; nextPageToken?: string | null }>(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/studentGroups?pageSize=${PAGE_SIZE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
      );

      return {
        items: (response.studentGroups ?? [])
          .map((group) => mapStudentGroup(courseId, group))
          .filter((item) => item.studentGroupId),
        nextPageToken: response.nextPageToken,
      };
    });

    return groups;
  }

  async listStudentGroupMembers(courseId: string, studentGroupId: string): Promise<SyncableStudentGroupMember[]> {
    return listAllPages(async (pageToken) => {
      const response = await this.requestJson<{ studentGroupMembers?: JsonObject[]; nextPageToken?: string | null }>(
        `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/studentGroups/${encodeURIComponent(studentGroupId)}/studentGroupMembers?pageSize=${PAGE_SIZE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
      );

      return {
        items: (response.studentGroupMembers ?? [])
          .map((member) => mapStudentGroupMember(courseId, studentGroupId, member))
          .filter((item) => item.userId),
        nextPageToken: response.nextPageToken,
      };
    });
  }

  async listGuardians(studentId: string): Promise<SyncableGuardian[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.userProfiles.guardians.list({ studentId, pageSize: PAGE_SIZE, pageToken }));
      return {
        items: (response.data.guardians ?? []).map((item) => mapGuardian(studentId, item)).filter((item) => item.guardianId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getGuardian(studentId: string, guardianId: string): Promise<SyncableGuardian> {
    const response = await withRetry(() => this.api.userProfiles.guardians.get({ studentId, guardianId }));
    return mapGuardian(studentId, response.data);
  }

  async listGuardianInvitations(studentId: string): Promise<SyncableGuardianInvitation[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.userProfiles.guardianInvitations.list({ studentId, pageSize: PAGE_SIZE, pageToken }));
      return {
        items: (response.data.guardianInvitations ?? [])
          .map((item) => mapGuardianInvitation(studentId, item))
          .filter((item) => item.invitationId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async getGuardianInvitation(studentId: string, invitationId: string): Promise<SyncableGuardianInvitation> {
    const response = await withRetry(() => this.api.userProfiles.guardianInvitations.get({ studentId, invitationId }));
    return mapGuardianInvitation(studentId, response.data);
  }
}
