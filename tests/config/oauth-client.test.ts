import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  normalizeOAuthClientFile,
  resolveLoginOAuthClient,
  saveOAuthClientConfig,
} from "../../src/config/oauth-client.js";

const tempRoot = path.join(os.tmpdir(), `classroom-backup-test-${Date.now()}`);

afterEach(() => {
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET_PATH;
});

describe("oauth client config", () => {
  it("normalizes installed app credentials JSON", async () => {
    await mkdir(tempRoot, { recursive: true });
    const credentialsPath = path.join(tempRoot, "client.json");
    await writeFile(
      credentialsPath,
      JSON.stringify({
        installed: {
          client_id: "client-id",
          client_secret: "client-secret",
          redirect_uris: ["http://127.0.0.1/callback"],
        },
      }),
    );

    await expect(normalizeOAuthClientFile(credentialsPath)).resolves.toEqual({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUris: ["http://127.0.0.1/callback"],
    });
  });

  it("uses CLI credentials before env and stored config", async () => {
    await mkdir(tempRoot, { recursive: true });
    const cliPath = path.join(tempRoot, "cli.json");
    const envPath = path.join(tempRoot, "env.json");
    const storedPath = path.join(tempRoot, "oauth-client.json");

    await writeFile(
      cliPath,
      JSON.stringify({ installed: { client_id: "cli", client_secret: "secret", redirect_uris: ["http://127.0.0.1"] } }),
    );
    await writeFile(
      envPath,
      JSON.stringify({ installed: { client_id: "env", client_secret: "secret", redirect_uris: ["http://127.0.0.1"] } }),
    );
    await saveOAuthClientConfig(storedPath, { clientId: "stored", clientSecret: "secret", redirectUris: ["http://127.0.0.1"] });
    process.env.GOOGLE_OAUTH_CLIENT_SECRET_PATH = envPath;

    await expect(resolveLoginOAuthClient({ credentialsPath: cliPath, configPath: storedPath })).resolves.toMatchObject({
      source: "cli",
      clientId: "cli",
    });
  });
});
