import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StateNotice } from "./StateNotice";

describe("StateNotice", () => {
  it("renders the notice title and description", () => {
    render(
      <StateNotice
        notice={{ code: "pending_materialization", tone: "warning", title: "Waiting", description: "Still processing." }}
      />,
    );

    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.getByText("Still processing.")).toBeTruthy();
  });
});
