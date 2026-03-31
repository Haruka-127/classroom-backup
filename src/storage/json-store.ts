import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class JsonStore {
  constructor(private readonly rootDir: string) {}

  async write(relativePath: string, value: unknown): Promise<string> {
    const outputPath = path.join(this.rootDir, relativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return outputPath;
  }
}
