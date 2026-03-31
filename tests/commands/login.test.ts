import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    classroom: () => ({
      courses: {
        list: vi.fn(async () => ({ data: {} })),
      },
    }),
    drive: () => ({
      about: {
        get: vi.fn(async () => ({ data: { user: { emailAddress: "student@example.com" } } })),
      },
    }),
  },
}));

vi.mock("../../src/auth/oauth.js", () => ({
  runLoopbackLogin: vi.fn(async () => ({
    tokens: { access_token: "access-token", refresh_token: "refresh-token", scope: "scope-a scope-b" },
    redirectUri: "http://127.0.0.1/callback",
    authorizationUrl: "https://example.com/oauth",
  })),
}));

vi.mock("../../src/auth/token-store.js", () => ({
  createTokenStore: () => ({
    save: vi.fn(async () => undefined),
  }),
}));

describe("runLoginCommand", () => {
  it("prints re-login guidance after successful login", async () => {
    const { runLoginCommand } = await import("../../src/commands/login.js");
    const root = await mkdtemp(path.join(os.tmpdir(), "classroom-login-test-"));
    const credentialsPath = path.join(root, "credentials.json");
    await mkdir(root, { recursive: true });
    await writeFile(
      credentialsPath,
      JSON.stringify({
        installed: {
          client_id: "client-id",
          client_secret: "secret",
          redirect_uris: ["http://127.0.0.1"],
        },
      }),
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await runLoginCommand({ credentials: credentialsPath, out: root });
      expect(logSpy).toHaveBeenCalledWith("If OAuth scopes were added or updated, run `login` again to refresh the stored token.");
    } finally {
      logSpy.mockRestore();
    }
  });
});
