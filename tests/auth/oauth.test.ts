import { get } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

let lastRedirectUri: string | undefined;

vi.mock("open", () => ({
  default: vi.fn(async () => undefined),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        constructor(_clientId: string, _clientSecret: string, redirectUri: string) {
          lastRedirectUri = redirectUri;
        }

        generateAuthUrl() {
          return "https://example.com/oauth";
        }

        async getToken() {
          return {
            tokens: {
              access_token: "access-token",
              refresh_token: "refresh-token",
            },
          };
        }

        setCredentials() {}
      },
    },
  },
}));

import { createAuthorizedClient, runLoopbackLogin } from "../../src/auth/oauth.js";

function countActiveServers(): number {
  const getActiveHandles = (process as typeof process & { _getActiveHandles(): unknown[] })._getActiveHandles;
  return getActiveHandles.call(process).filter((handle) => {
    return typeof handle === "object" && handle !== null && handle.constructor?.name === "Server";
  }).length;
}

function countActiveServersForPort(port: number): number {
  const getActiveHandles = (process as typeof process & { _getActiveHandles(): unknown[] })._getActiveHandles;
  return getActiveHandles.call(process).filter((handle) => {
    if (typeof handle !== "object" || handle === null || handle.constructor?.name !== "Server") {
      return false;
    }

    const address = (handle as { address?: () => { port?: number } | null }).address?.();
    return address?.port === port;
  }).length;
}

afterEach(() => {
  lastRedirectUri = undefined;
});

describe("createAuthorizedClient", () => {
  it("fails when stored scopes do not satisfy required scopes", async () => {
    await expect(
      createAuthorizedClient({
        clientConfig: {
          clientId: "client-id",
          clientSecret: "secret",
          redirectUris: ["http://127.0.0.1"],
        },
        tokenStore: {
          async load() {
            return {
              access_token: "access-token",
              refresh_token: "refresh-token",
              scope: "https://www.googleapis.com/auth/classroom.courses.readonly",
            };
          },
          async save() {},
          async clear() {},
        },
        scopes: [
          "https://www.googleapis.com/auth/classroom.courses.readonly",
          "https://www.googleapis.com/auth/classroom.rosters.readonly",
        ],
        accountKey: "client-id",
      }),
    ).rejects.toThrow("Stored OAuth tokens do not include the required scopes. Run `login` again.");
  });

  it("accepts the granted student-submissions alias for coursework.me.readonly", async () => {
    const client = await createAuthorizedClient({
      clientConfig: {
        clientId: "client-id",
        clientSecret: "secret",
        redirectUris: ["http://127.0.0.1"],
      },
      tokenStore: {
        async load() {
          return {
            access_token: "access-token",
            refresh_token: "refresh-token",
            scope: "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly https://www.googleapis.com/auth/drive.readonly",
          };
        },
        async save() {},
        async clear() {},
      },
      scopes: [
        "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      accountKey: "client-id",
    });

    expect(client).toBeTruthy();
  });
});

describe("runLoopbackLogin", () => {
  it("waits for the loopback callback server to close before resolving", async () => {
    const baselineServerCount = countActiveServers();
    const loginPromise = runLoopbackLogin(
      {
        clientId: "client-id",
        clientSecret: "secret",
        redirectUris: ["http://127.0.0.1"],
      },
      ["scope-a"],
    );

    await vi.waitFor(() => {
      expect(lastRedirectUri).toBeTruthy();
    });

    const redirectPort = new URL(lastRedirectUri!).port;

    await new Promise<void>((resolve, reject) => {
      const request = get(`${lastRedirectUri}?code=test-code`, (response) => {
        response.resume();
        response.on("end", resolve);
        response.on("error", reject);
      });

      request.on("error", reject);
    });

    const result = await loginPromise;

    expect(result.tokens.access_token).toBe("access-token");
    await vi.waitFor(
      () => {
        expect(countActiveServersForPort(Number(redirectPort))).toBe(0);
        expect(countActiveServers()).toBe(baselineServerCount);
      },
      { timeout: 200 },
    );
  });
});
