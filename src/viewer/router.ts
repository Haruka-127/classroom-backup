import type { IncomingMessage, ServerResponse } from "node:http";

import { ViewerReadModel } from "./read-model.js";
import { readArtifactFile, readViewerSpaFallback, readViewerStaticFile } from "./static-files.js";
import type { ViewerApiErrorResponse } from "./types.js";

export interface ViewerRouterDependencies {
  readModel: ViewerReadModel;
  filesRoot: string;
  staticRoot: string;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendError(response: ServerResponse, statusCode: number, message: string): void {
  const payload: ViewerApiErrorResponse = {
    error: { message },
  };
  sendJson(response, statusCode, payload);
}

function sendFile(response: ServerResponse, file: { content: Buffer; contentType: string }): void {
  response.writeHead(200, { "content-type": file.contentType });
  response.end(file.content);
}

function getRequestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? "/", "http://127.0.0.1");
}

export async function routeViewerRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: ViewerRouterDependencies,
): Promise<void> {
  const url = getRequestUrl(request);
  const pathname = url.pathname;

  if (request.method !== "GET") {
    sendError(response, 405, "Viewer API is read-only.");
    return;
  }

  if (pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/courses") {
    sendJson(response, 200, dependencies.readModel.listCourses());
    return;
  }

  const segments = pathname.split("/").filter(Boolean);
  const courseId = segments[2];
  const subResource = segments[3];
  const entityId = segments[4];

  if (segments[0] === "api" && segments[1] === "courses" && segments.length === 3 && courseId) {
    const course = dependencies.readModel.getCourse(decodeURIComponent(courseId));
    if (!course) {
      sendError(response, 404, "Course not found.");
      return;
    }

    sendJson(response, 200, course);
    return;
  }

  if (segments[0] === "api" && segments[1] === "courses" && subResource === "stream" && segments.length === 4 && courseId) {
    const stream = dependencies.readModel.getCourseStream(decodeURIComponent(courseId));
    if (!stream) {
      sendError(response, 404, "Course not found.");
      return;
    }

    sendJson(response, 200, stream);
    return;
  }

  if (segments[0] === "api" && segments[1] === "courses" && subResource === "classwork" && segments.length === 4 && courseId) {
    const classwork = dependencies.readModel.getCourseClasswork(decodeURIComponent(courseId));
    if (!classwork) {
      sendError(response, 404, "Course not found.");
      return;
    }

    sendJson(response, 200, classwork);
    return;
  }

  if (segments[0] === "api" && segments[1] === "courses" && subResource === "course-work" && segments.length === 5 && courseId && entityId) {
    const detail = dependencies.readModel.getCourseWorkDetail(decodeURIComponent(courseId), decodeURIComponent(entityId));
    if (!detail) {
      sendError(response, 404, "Course work not found.");
      return;
    }

    sendJson(response, 200, detail);
    return;
  }

  if (
    segments[0] === "api" &&
    segments[1] === "courses" &&
    subResource === "course-work-materials" &&
    segments.length === 5 &&
    courseId &&
    entityId
  ) {
    const detail = dependencies.readModel.getCourseWorkMaterialDetail(decodeURIComponent(courseId), decodeURIComponent(entityId));
    if (!detail) {
      sendError(response, 404, "Course work material not found.");
      return;
    }

    sendJson(response, 200, detail);
    return;
  }

  if (segments[0] === "api" && segments[1] === "files" && segments.length === 3 && courseId) {
    const file = dependencies.readModel.getDriveFile(decodeURIComponent(courseId));
    if (!file) {
      sendError(response, 404, "Drive file not found.");
      return;
    }

    sendJson(response, 200, file);
    return;
  }

  if (pathname.startsWith("/api/artifacts/")) {
    const relativePath = pathname.slice("/api/artifacts/".length);
    const artifact = await readArtifactFile(dependencies.filesRoot, relativePath);
    if (!artifact) {
      sendError(response, 404, "Artifact not found.");
      return;
    }

    sendFile(response, artifact);
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendError(response, 404, "Viewer API route not found.");
    return;
  }

  const staticFile = await readViewerStaticFile(dependencies.staticRoot, pathname);
  if (staticFile) {
    sendFile(response, staticFile);
    return;
  }

  const fallback = await readViewerSpaFallback(dependencies.staticRoot);
  if (fallback) {
    sendFile(response, fallback);
    return;
  }

  sendError(response, 500, "Viewer frontend assets are missing. Run npm run build first.");
}
