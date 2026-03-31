import { describe, expect, it } from "vitest";

import { getExportTargets, isGoogleWorkspaceMimeType } from "../../src/domain/export-strategy.js";

describe("export strategy", () => {
  it("returns preferred formats for docs", () => {
    expect(getExportTargets("application/vnd.google-apps.document")).toEqual([
      { mimeType: "application/pdf", extension: ".pdf" },
      { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: ".docx" },
    ]);
  });

  it("detects workspace mime types", () => {
    expect(isGoogleWorkspaceMimeType("application/vnd.google-apps.spreadsheet")).toBe(true);
    expect(isGoogleWorkspaceMimeType("application/pdf")).toBe(false);
  });
});
