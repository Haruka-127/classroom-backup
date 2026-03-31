import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SavedArtifactInfo {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  checksumType: "md5" | "sha256";
  checksumValue: string;
}

export class FileStore {
  constructor(private readonly rootDir: string) {}

  async saveBuffer(relativePath: string, content: Buffer, checksumType: "md5" | "sha256" = "sha256"): Promise<SavedArtifactInfo> {
    const absolutePath = path.join(this.rootDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
    const stats = await stat(absolutePath);
    const checksumValue = createHash(checksumType).update(content).digest("hex");

    return {
      relativePath,
      absolutePath,
      sizeBytes: stats.size,
      checksumType,
      checksumValue,
    };
  }
}
