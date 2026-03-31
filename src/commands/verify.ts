import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { resolveAppPaths } from "../config/app-paths.js";

export interface VerifyCommandOptions {
  out: string;
}

interface ManifestFile {
  artifacts: Array<{
    relativePath: string;
    status: string;
  }>;
}

export async function runVerifyCommand(options: VerifyCommandOptions): Promise<void> {
  const paths = resolveAppPaths(options.out);
  const manifest = JSON.parse(await readFile(paths.manifestPath, "utf8")) as ManifestFile;
  const missing: string[] = [];

  for (const artifact of manifest.artifacts) {
    if (artifact.status !== "saved") {
      continue;
    }

    const absolutePath = path.join(paths.filesRoot, artifact.relativePath);
    try {
      await access(absolutePath);
    } catch {
      missing.push(artifact.relativePath);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Verify failed. Missing artifact files: ${missing.join(", ")}`);
  }

  console.log(`Verify succeeded. Checked ${manifest.artifacts.length} manifest artifacts.`);
}
