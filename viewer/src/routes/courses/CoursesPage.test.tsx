import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoursesPage } from "./CoursesPage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CoursesPage", () => {
  it("renders course cards from the API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          courses: [{ courseId: "course-1", name: "Math", section: "A", room: "101", courseState: "ACTIVE", alternateLink: null, updateTime: null, bannerColor: "#000" }],
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Math")).toBeTruthy());
  });
});
