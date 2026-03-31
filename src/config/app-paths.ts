import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const APP_NAME = "classroom-backup";

export interface AppPaths {
  outputRoot: string;
  filesRoot: string;
  jsonRoot: string;
  reportsRoot: string;
  logsRoot: string;
  databasePath: string;
  manifestPath: string;
  statusReportPath: string;
  configRoot: string;
  oauthClientPath: string;
}

function resolveDefaultConfigRoot(): string {
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA ?? process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Local"), APP_NAME);
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
  }

  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), APP_NAME);
}

export function resolveAppPaths(outDir: string): AppPaths {
  const outputRoot = path.resolve(outDir);
  const configRoot = resolveDefaultConfigRoot();

  return {
    outputRoot,
    filesRoot: path.join(outputRoot, "files"),
    jsonRoot: path.join(outputRoot, "json"),
    reportsRoot: path.join(outputRoot, "reports"),
    logsRoot: path.join(outputRoot, "logs"),
    databasePath: path.join(outputRoot, "backup.sqlite"),
    manifestPath: path.join(outputRoot, "manifest.json"),
    statusReportPath: path.join(outputRoot, "reports", "status-report.json"),
    configRoot,
    oauthClientPath: path.join(configRoot, "oauth-client.json"),
  };
}

async function ensureDirectory(targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true });

  if (process.platform !== "win32") {
    await import("node:fs/promises").then(({ chmod }) => chmod(targetPath, 0o700));
  }
}

export async function ensureAppDirectories(paths: AppPaths): Promise<void> {
  await Promise.all([
    ensureDirectory(paths.outputRoot),
    ensureDirectory(paths.filesRoot),
    ensureDirectory(paths.jsonRoot),
    ensureDirectory(paths.reportsRoot),
    ensureDirectory(paths.logsRoot),
    ensureDirectory(paths.configRoot),
  ]);
}
