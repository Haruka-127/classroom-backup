import { access, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mime from "mime-types";

export interface ResolvedFile {
  absolutePath: string;
  content: Buffer;
  contentType: string;
}

function isSafeChildPath(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function getContentType(targetPath: string): string {
  const resolved = mime.lookup(targetPath) || "application/octet-stream";
  return resolved.startsWith("text/") ? `${resolved}; charset=utf-8` : resolved;
}

export function resolveViewerStaticRoot(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(moduleDirectory, "../../dist/viewer"), path.resolve(moduleDirectory, "../../viewer")];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

export async function readViewerStaticFile(staticRoot: string, requestPath: string): Promise<ResolvedFile | null> {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const absolutePath = path.resolve(staticRoot, `.${normalizedPath}`);

  if (!isSafeChildPath(staticRoot, absolutePath)) {
    return null;
  }

  try {
    await access(absolutePath);
    return {
      absolutePath,
      content: await readFile(absolutePath),
      contentType: getContentType(absolutePath),
    };
  } catch {
    return null;
  }
}

export async function readViewerSpaFallback(staticRoot: string): Promise<ResolvedFile | null> {
  return readViewerStaticFile(staticRoot, "/index.html");
}
