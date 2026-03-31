import { createServer } from "node:http";
import { access } from "node:fs/promises";

import { resolveAppPaths } from "../config/app-paths.js";
import { closeDatabase, openReadOnlyDatabase } from "../storage/db.js";
import { ViewerReadModel } from "./read-model.js";
import { routeViewerRequest } from "./router.js";
import { resolveViewerStaticRoot } from "./static-files.js";

export interface StartViewerServerOptions {
  outDir: string;
  port: number;
  staticRoot?: string;
}

export interface ViewerServerHandle {
  origin: string;
  outDir: string;
  port: number;
  close: () => Promise<void>;
}

async function assertBackupExists(databasePath: string): Promise<void> {
  try {
    await access(databasePath);
  } catch {
    throw new Error(
      `No backup database found at ${databasePath}. Run \`classroom-backup backup full --out <dir>\` or \`backup sync\` first.`,
    );
  }
}

export async function startViewerServer(options: StartViewerServerOptions): Promise<ViewerServerHandle> {
  const paths = resolveAppPaths(options.outDir);
  await assertBackupExists(paths.databasePath);

  const db = openReadOnlyDatabase(paths.databasePath);
  const readModel = new ViewerReadModel(db);
  const staticRoot = options.staticRoot ?? resolveViewerStaticRoot();
  const server = createServer((request, response) => {
    void routeViewerRequest(request, response, {
      readModel,
      filesRoot: paths.filesRoot,
      staticRoot,
    }).catch((error: unknown) => {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          error: { message: error instanceof Error ? error.message : String(error) },
        }),
      );
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    closeDatabase(db);
    throw new Error("Viewer server did not return a TCP address.");
  }

  let closed = false;
  const close = async () => {
    if (closed) {
      return;
    }

    closed = true;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    closeDatabase(db);
  };

  return {
    origin: `http://127.0.0.1:${address.port}`,
    outDir: paths.outputRoot,
    port: address.port,
    close,
  };
}
