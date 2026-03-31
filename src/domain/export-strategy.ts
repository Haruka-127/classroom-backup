export interface ExportTarget {
  mimeType: string;
  extension: string;
}

const EXPORT_PRIORITIES: Record<string, ExportTarget[]> = {
  "application/vnd.google-apps.document": [
    { mimeType: "application/pdf", extension: ".pdf" },
    { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: ".docx" },
  ],
  "application/vnd.google-apps.spreadsheet": [
    { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: ".xlsx" },
    { mimeType: "application/pdf", extension: ".pdf" },
  ],
  "application/vnd.google-apps.presentation": [
    { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: ".pptx" },
    { mimeType: "application/pdf", extension: ".pdf" },
  ],
  "application/vnd.google-apps.drawing": [{ mimeType: "image/png", extension: ".png" }],
  "application/vnd.google-apps.script": [{ mimeType: "application/vnd.google-apps.script+json", extension: ".json" }],
};

export function isGoogleWorkspaceMimeType(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType?.startsWith("application/vnd.google-apps."));
}

export function getExportTargets(mimeType: string | null | undefined): ExportTarget[] {
  if (!mimeType) {
    return [];
  }

  return EXPORT_PRIORITIES[mimeType] ?? [{ mimeType: "application/pdf", extension: ".pdf" }];
}
