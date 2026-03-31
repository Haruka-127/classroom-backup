import pLimit from "p-limit";
import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import type { classroom_v1 } from "googleapis";

import type {
  SyncableAnnouncement,
  SyncableCourse,
  SyncableCourseWork,
  SyncableCourseWorkMaterial,
  SyncableStudentSubmission,
  SyncableTopic,
} from "../../domain/classroom-types.js";
import { withRetry } from "./retry.js";

const COURSE_STATES: classroom_v1.Params$Resource$Courses$List["courseStates"] = ["ACTIVE", "ARCHIVED", "PROVISIONED", "DECLINED"];

export interface CourseBundle {
  course: SyncableCourse;
  topics: SyncableTopic[];
  announcements: SyncableAnnouncement[];
  courseWork: SyncableCourseWork[];
  courseWorkMaterials: SyncableCourseWorkMaterial[];
  studentSubmissions: SyncableStudentSubmission[];
}

export interface ClassroomService {
  listCourses(): Promise<SyncableCourse[]>;
  listTopics(courseId: string): Promise<SyncableTopic[]>;
  listAnnouncements(courseId: string): Promise<SyncableAnnouncement[]>;
  listCourseWork(courseId: string): Promise<SyncableCourseWork[]>;
  listCourseWorkMaterials(courseId: string): Promise<SyncableCourseWorkMaterial[]>;
  listStudentSubmissions(courseId: string): Promise<SyncableStudentSubmission[]>;
  fetchCourseBundles(): Promise<CourseBundle[]>;
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
  };
}

function mapTopic(courseId: string, topic: classroom_v1.Schema$Topic): SyncableTopic {
  return {
    courseId,
    topicId: topic.topicId ?? "",
    name: topic.name ?? null,
    updateTime: topic.updateTime ?? null,
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

  constructor(auth: OAuth2Client | null) {
    if (!auth) {
      throw new Error("Authorized Google client is required for Classroom API access.");
    }

    this.api = google.classroom({ version: "v1", auth });
  }

  async listCourses(): Promise<SyncableCourse[]> {
    const courses = await listAllPages(async (pageToken) => {
      const response = await withRetry(() =>
        this.api.courses.list({
          studentId: "me",
          pageSize: 100,
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

  async listTopics(courseId: string): Promise<SyncableTopic[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.courses.topics.list({ courseId, pageSize: 100, pageToken }));
      return {
        items: (response.data.topic ?? []).map((item) => mapTopic(courseId, item)).filter((item) => item.topicId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async listAnnouncements(courseId: string): Promise<SyncableAnnouncement[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() =>
        this.api.courses.announcements.list({ courseId, pageSize: 100, pageToken }),
      );
      return {
        items: (response.data.announcements ?? [])
          .map((item) => mapAnnouncement(courseId, item))
          .filter((item) => item.announcementId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async listCourseWork(courseId: string): Promise<SyncableCourseWork[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() => this.api.courses.courseWork.list({ courseId, pageSize: 100, pageToken }));
      return {
        items: (response.data.courseWork ?? []).map((item) => mapCourseWork(courseId, item)).filter((item) => item.courseWorkId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async listCourseWorkMaterials(courseId: string): Promise<SyncableCourseWorkMaterial[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() =>
        this.api.courses.courseWorkMaterials.list({ courseId, pageSize: 100, pageToken }),
      );
      return {
        items: (response.data.courseWorkMaterial ?? [])
          .map((item) => mapCourseWorkMaterial(courseId, item))
          .filter((item) => item.courseWorkMaterialId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async listStudentSubmissions(courseId: string): Promise<SyncableStudentSubmission[]> {
    return listAllPages(async (pageToken) => {
      const response = await withRetry(() =>
        this.api.courses.courseWork.studentSubmissions.list({ courseId, courseWorkId: "-", userId: "me", pageSize: 100, pageToken }),
      );

      return {
        items: (response.data.studentSubmissions ?? [])
          .map((item) => mapStudentSubmission(courseId, item))
          .filter((item) => item.submissionId && item.courseWorkId),
        nextPageToken: response.data.nextPageToken,
      };
    });
  }

  async fetchCourseBundles(): Promise<CourseBundle[]> {
    const courses = await this.listCourses();
    const limit = pLimit(4);

    return Promise.all(
      courses.map((course) =>
        limit(async () => ({
          course,
          topics: await this.listTopics(course.id),
          announcements: await this.listAnnouncements(course.id),
          courseWork: await this.listCourseWork(course.id),
          courseWorkMaterials: await this.listCourseWorkMaterials(course.id),
          studentSubmissions: await this.listStudentSubmissions(course.id),
        })),
      ),
    );
  }
}
