import { writeFile } from "node:fs/promises";

import type { ManifestArtifactEntry } from "../domain/classroom-types.js";

export interface BackupManifest {
  generatedAt: string;
  runId: string;
  artifacts: ManifestArtifactEntry[];
  pendingMaterializationCount: number;
  failuresCount: number;
}

export async function writeManifest(filePath: string, manifest: BackupManifest): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
