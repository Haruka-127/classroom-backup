import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { URL } from "node:url";
import { CodeChallengeMethod } from "google-auth-library";
import type { Credentials } from "google-auth-library";
import { google } from "googleapis";
import open from "open";

import type { OAuthClientConfig } from "../config/oauth-client.js";
import type { TokenStore } from "./token-store.js";

export interface LoginResult {
  tokens: Credentials;
  redirectUri: string;
  authorizationUrl: string;
}

const EQUIVALENT_GRANTED_SCOPES: Record<string, string[]> = {
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly": [
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
  ],
};

function parseStoredScopes(scope: string | null | undefined): Set<string> {
  return new Set(
    (scope ?? "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function hasGrantedScope(grantedScopes: Set<string>, requiredScope: string): boolean {
  if (grantedScopes.has(requiredScope)) {
    return true;
  }

  return (EQUIVALENT_GRANTED_SCOPES[requiredScope] ?? []).some((scope) => grantedScopes.has(scope));
}

function toBase64Url(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = toBase64Url(randomBytes(32));
  const challenge = toBase64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function waitForAuthorizationCode(): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for OAuth callback."));
    }, 5 * 60 * 1000);

    const server = createServer((request, response) => {
      const requestUrl = request.url ? new URL(request.url, "http://127.0.0.1") : null;
      const code = requestUrl?.searchParams.get("code");
      const error = requestUrl?.searchParams.get("error");

      response.statusCode = error ? 400 : 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(error ? `<h1>Login failed</h1><p>${error}</p>` : "<h1>Login complete</h1><p>You can close this window.</p>");

      clearTimeout(timeout);
      server.close();

      if (error) {
        reject(new Error(`OAuth authorization failed: ${error}`));
        return;
      }

      if (!code) {
        reject(new Error("OAuth callback did not include an authorization code."));
        return;
      }

      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to resolve local OAuth redirect server address."));
        return;
      }

      resolve({ code, redirectUri: `http://127.0.0.1:${address.port}/oauth/callback` });
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1");
  });
}

async function createLoopbackRedirectServer(): Promise<{
  redirectUri: string;
  waitForCode: Promise<string>;
}> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to allocate loopback redirect URI."));
        return;
      }

      const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`;
      const waitForCode = new Promise<string>((resolveCode, rejectCode) => {
        const timeout = setTimeout(() => {
          server.close();
          rejectCode(new Error("Timed out waiting for OAuth callback."));
        }, 5 * 60 * 1000);

        server.removeAllListeners("request");
        server.on("request", (request, response) => {
          const requestUrl = request.url ? new URL(request.url, redirectUri) : null;
          const code = requestUrl?.searchParams.get("code");
          const error = requestUrl?.searchParams.get("error");

          response.statusCode = error ? 400 : 200;
          response.setHeader("content-type", "text/html; charset=utf-8");
          response.end(error ? `<h1>Login failed</h1><p>${error}</p>` : "<h1>Login complete</h1><p>You can close this window.</p>");

          clearTimeout(timeout);
          server.close();

          if (error) {
            rejectCode(new Error(`OAuth authorization failed: ${error}`));
            return;
          }

          if (!code) {
            rejectCode(new Error("OAuth callback did not include an authorization code."));
            return;
          }

          resolveCode(code);
        });
      });

      resolve({ redirectUri, waitForCode });
    });
  });
}

export async function runLoopbackLogin(
  clientConfig: OAuthClientConfig,
  scopes: readonly string[],
): Promise<LoginResult> {
  const pkce = createPkcePair();
  const { redirectUri, waitForCode } = await createLoopbackRedirectServer();

  const client = new google.auth.OAuth2(clientConfig.clientId, clientConfig.clientSecret, redirectUri);
  const authorizationUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...scopes],
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: pkce.challenge,
  });

  try {
    await open(authorizationUrl);
  } catch {
    // The command prints the URL so the user can still continue manually.
  }

  const code = await waitForCode;
  const oauthClient = new google.auth.OAuth2(clientConfig.clientId, clientConfig.clientSecret, redirectUri);
  const { tokens } = await oauthClient.getToken({ code, codeVerifier: pkce.verifier, redirect_uri: redirectUri });

  return { tokens, redirectUri, authorizationUrl };
}

export async function createAuthorizedClient(options: {
  clientConfig: OAuthClientConfig;
  tokenStore: TokenStore;
  scopes: readonly string[];
  accountKey: string;
}) {
  const storedTokens = await options.tokenStore.load(options.accountKey);
  if (!storedTokens?.refresh_token && !storedTokens?.access_token) {
    throw new Error("Stored OAuth tokens were not found. Run `login` first.");
  }

  const grantedScopes = parseStoredScopes(storedTokens.scope);
  const missingScopes = options.scopes.filter((scope) => !hasGrantedScope(grantedScopes, scope));
  if (missingScopes.length > 0) {
    throw new Error("Stored OAuth tokens do not include the required scopes. Run `login` again.");
  }

  const client = new google.auth.OAuth2(
    options.clientConfig.clientId,
    options.clientConfig.clientSecret,
    options.clientConfig.redirectUris[0] ?? "http://127.0.0.1",
  );

  client.setCredentials({
    access_token: storedTokens.access_token ?? null,
    refresh_token: storedTokens.refresh_token ?? null,
    scope: storedTokens.scope ?? undefined,
    token_type: storedTokens.token_type ?? undefined,
    expiry_date: storedTokens.expiry_date ?? undefined,
  });

  return client;
}
