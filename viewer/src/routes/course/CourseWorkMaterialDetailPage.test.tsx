import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CourseWorkMaterialDetailPage } from "./CourseWorkMaterialDetailPage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CourseWorkMaterialDetailPage", () => {
  it("renders notice text for unavailable material state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          courseId: "course-1",
          courseWorkMaterialId: "cwm-1",
          title: "Reference",
          description: null,
          state: "PUBLISHED",
          topicId: null,
          topicName: null,
          updateTime: null,
          alternateLink: null,
          notices: [{ code: "unsupported", tone: "info", title: "API では取得不可", description: "Unavailable" }],
          attachments: [],
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter initialEntries={["/courses/course-1/course-work-materials/cwm-1"]}>
        <Routes>
          <Route path="/courses/:courseId/course-work-materials/:courseWorkMaterialId" element={<CourseWorkMaterialDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("API では取得不可")).toBeTruthy());
  });
});
