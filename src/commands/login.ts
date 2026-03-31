import { google } from "googleapis";

import { createTokenStore } from "../auth/token-store.js";
import { runLoopbackLogin } from "../auth/oauth.js";
import { ensureAppDirectories, resolveAppPaths } from "../config/app-paths.js";
import { resolveLoginOAuthClient, saveOAuthClientConfig } from "../config/oauth-client.js";
import { GOOGLE_OAUTH_SCOPES } from "../config/scopes.js";

export interface LoginCommandOptions {
  credentials?: string;
  out?: string;
}

export async function runLoginCommand(options: LoginCommandOptions): Promise<void> {
  const paths = resolveAppPaths(options.out ?? "./backup");
  await ensureAppDirectories(paths);

  const resolvedClient = await resolveLoginOAuthClient({
    credentialsPath: options.credentials,
    configPath: paths.oauthClientPath,
  });

  const loginResult = await runLoopbackLogin(resolvedClient, GOOGLE_OAUTH_SCOPES);
  const oauthClient = new google.auth.OAuth2(resolvedClient.clientId, resolvedClient.clientSecret, loginResult.redirectUri);
  oauthClient.setCredentials(loginResult.tokens);

  const tokenStore = createTokenStore();
  const accountKey = resolvedClient.clientId;
  await tokenStore.save(accountKey, loginResult.tokens);
  await saveOAuthClientConfig(paths.oauthClientPath, resolvedClient);

  const classroom = google.classroom({ version: "v1", auth: oauthClient });
  const drive = google.drive({ version: "v3", auth: oauthClient });

  await classroom.courses.list({ studentId: "me", pageSize: 1, courseStates: ["ACTIVE", "ARCHIVED", "PROVISIONED", "DECLINED"] });
  const about = await drive.about.get({ fields: "user(displayName,emailAddress,permissionId)" });

  console.log(`Logged in successfully using credentials source: ${resolvedClient.source} (${resolvedClient.sourcePath})`);
  console.log(`Registered OAuth client saved to: ${paths.oauthClientPath}`);
  console.log(`Drive account: ${about.data.user?.emailAddress ?? "unknown"}`);
  console.log(`If the browser did not open automatically, use this URL:`);
  console.log(loginResult.authorizationUrl);
}
