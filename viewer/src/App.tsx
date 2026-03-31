import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { PageShell } from "./components/PageShell";
import { ScrollRestoration } from "./components/ScrollRestoration";
import { ViewerShellProvider } from "./components/ViewerShellContext";
import { CoursePage } from "./routes/course/CoursePage";
import { CourseWorkDetailPage } from "./routes/course/CourseWorkDetailPage";
import { CourseWorkMaterialDetailPage } from "./routes/course/CourseWorkMaterialDetailPage";
import { CoursesPage } from "./routes/courses/CoursesPage";

export function App() {
  return (
    <BrowserRouter>
      <ViewerShellProvider>
        <ScrollRestoration />
        <PageShell>
          <Routes>
            <Route path="/" element={<CoursesPage />} />
            <Route path="/courses/:courseId" element={<CoursePage />} />
            <Route path="/courses/:courseId/course-work/:courseWorkId" element={<CourseWorkDetailPage />} />
            <Route
              path="/courses/:courseId/course-work-materials/:courseWorkMaterialId"
              element={<CourseWorkMaterialDetailPage />}
            />
          </Routes>
        </PageShell>
      </ViewerShellProvider>
    </BrowserRouter>
  );
}
