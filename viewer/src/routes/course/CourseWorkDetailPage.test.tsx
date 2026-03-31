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
          dueLabel: "提出期限: 2026/3/31 23:59",
          pointsLabel: "100 点",
          attachments: [],
          rubrics: [
            {
              rubricId: "rubric-1",
              title: "採点基準",
              criteria: [{ criterionId: "criterion-1", title: "内容", description: null, levels: [{ levelId: "level-1", title: "達成", description: null, points: 5 }] }],
            },
          ],
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
            history: [{ entryId: "state-1", title: "状態が TURNED_IN に変更されました", description: null, actorName: "Teacher", timestamp: null }],
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
    expect(screen.getByText("採点基準")).toBeTruthy();
    expect(screen.getByText("状態が TURNED_IN に変更されました")).toBeTruthy();
  });
});
