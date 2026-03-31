import type {
  ViewerClassworkResponse,
  ViewerCourseDetail,
  ViewerCourseListResponse,
  ViewerCoursePeopleResponse,
  ViewerCourseWorkDetail,
  ViewerCourseWorkMaterialDetail,
  ViewerDriveFile,
  ViewerStreamResponse,
} from "./types";

interface ErrorPayload {
  error?: {
    message?: string;
  };
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as ErrorPayload;
      message = payload.error?.message || message;
    } catch {
      // Ignore invalid JSON error bodies.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const viewerApi = {
  getCourses: () => request<ViewerCourseListResponse>("/api/courses"),
  getCourse: (courseId: string) => request<ViewerCourseDetail>(`/api/courses/${encodeURIComponent(courseId)}`),
  getStream: (courseId: string) => request<ViewerStreamResponse>(`/api/courses/${encodeURIComponent(courseId)}/stream`),
  getClasswork: (courseId: string) => request<ViewerClassworkResponse>(`/api/courses/${encodeURIComponent(courseId)}/classwork`),
  getPeople: (courseId: string) => request<ViewerCoursePeopleResponse>(`/api/courses/${encodeURIComponent(courseId)}/people`),
  getCourseWork: (courseId: string, courseWorkId: string) =>
    request<ViewerCourseWorkDetail>(`/api/courses/${encodeURIComponent(courseId)}/course-work/${encodeURIComponent(courseWorkId)}`),
  getCourseWorkMaterial: (courseId: string, courseWorkMaterialId: string) =>
    request<ViewerCourseWorkMaterialDetail>(
      `/api/courses/${encodeURIComponent(courseId)}/course-work-materials/${encodeURIComponent(courseWorkMaterialId)}`,
    ),
  getFile: (driveFileId: string) => request<ViewerDriveFile>(`/api/files/${encodeURIComponent(driveFileId)}`),
};
