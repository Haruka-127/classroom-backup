import { describe, expect, it } from "vitest";

import { createAuthorizedClient } from "../../src/auth/oauth.js";

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
