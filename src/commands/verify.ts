import { createHash } from "node:crypto";

import { resolveAppPaths } from "../config/app-paths.js";
import { closeDatabase, openDatabase } from "../storage/db.js";
import { createRepositories } from "../storage/repositories/index.js";

export interface VerifyCommandOptions {
  out: string;
}

export async function runVerifyCommand(options: VerifyCommandOptions): Promise<void> {
  const paths = resolveAppPaths(options.out);
  const db = openDatabase(paths.databasePath);

  try {
    const repositories = createRepositories(db);
    const artifacts = repositories.driveFileArtifacts.listSavedWithBlobs();
    const failures: string[] = [];

    for (const artifact of artifacts) {
      if (!artifact.blobId || !artifact.blobContent) {
        failures.push(`artifact ${artifact.artifactId} is missing blob content`);
        continue;
      }

      const actualSize = artifact.blobContent.byteLength;
      const actualSha256 = createHash("sha256").update(artifact.blobContent).digest("hex");

      if (artifact.sizeBytes !== null && artifact.sizeBytes !== undefined && artifact.sizeBytes !== actualSize) {
        failures.push(`artifact ${artifact.artifactId} size mismatch`);
      }

      if (artifact.checksumType === "sha256" && artifact.checksumValue && artifact.checksumValue !== actualSha256) {
        failures.push(`artifact ${artifact.artifactId} checksum mismatch`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Verify failed. ${failures.length} artifact checks failed: ${failures.join(", ")}`);
    }

    console.log(`Verify succeeded. Checked ${artifacts.length} saved artifacts in backup.sqlite.`);
  } finally {
    closeDatabase(db);
  }
}
