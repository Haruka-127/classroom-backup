import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoursePage } from "./CoursePage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CoursePage", () => {
  it("switches between Stream and Classwork tabs", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/stream")) {
        return new Response(JSON.stringify({ courseId: "course-1", items: [] }), { status: 200 });
      }
      if (url.includes("/classwork")) {
        return new Response(JSON.stringify({ courseId: "course-1", sections: [{ topicId: null, topicName: "No topic", items: [] }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          courseId: "course-1",
          name: "Math",
          section: "A",
          room: "101",
          descriptionHeading: null,
          description: null,
          alternateLink: null,
          courseState: "ACTIVE",
          updateTime: null,
          bannerColor: "#000",
          notices: [],
        }),
        { status: 200 },
      );
    });

    render(
      <MemoryRouter initialEntries={["/courses/course-1"]}>
        <Routes>
          <Route path="/courses/:courseId" element={<CoursePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Classwork" })).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Classwork" }));
    expect(screen.getByText("No topic")).toBeTruthy();
  });
});
