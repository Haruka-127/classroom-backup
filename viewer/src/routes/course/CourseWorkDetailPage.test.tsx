import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CourseWorkDetailPage } from "./CourseWorkDetailPage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CourseWorkDetailPage", () => {
  it("renders submission state and answers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          courseId: "course-1",
          courseWorkId: "cw-1",
          title: "Assignment",
          description: null,
          workType: "ASSIGNMENT",
          state: "PUBLISHED",
          topicId: null,
          topicName: null,
          updateTime: null,
          alternateLink: null,
          attachments: [],
          notices: [],
          submission: {
            submissionId: "submission-1",
            state: "TURNED_IN",
            late: false,
            updateTime: null,
            assignedGrade: 100,
            draftGrade: 95,
            shortAnswer: "42",
            multipleChoiceAnswer: null,
            alternateLink: null,
            attachments: [],
            notices: [],
          },
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter initialEntries={["/courses/course-1/course-work/cw-1"]}>
        <Routes>
          <Route path="/courses/:courseId/course-work/:courseWorkId" element={<CourseWorkDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("状態: 提出済み")).toBeTruthy());
    expect(screen.getByText("記述式の回答: 42")).toBeTruthy();
  });
});
