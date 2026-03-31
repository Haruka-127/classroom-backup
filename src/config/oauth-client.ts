import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const installedClientSchema = z.object({
  installed: z.object({
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    redirect_uris: z.array(z.string().url()).min(1),
  }),
});

const normalizedClientSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUris: z.array(z.string().min(1)).min(1),
});

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
}

export type OAuthClientSource = "cli" | "env" | "stored";

export interface ResolvedOAuthClient extends OAuthClientConfig {
  source: OAuthClientSource;
  sourcePath: string;
}

export class OAuthClientConfigError extends Error {}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function normalizeOAuthClientFile(filePath: string): Promise<OAuthClientConfig> {
  const raw = JSON.parse(await readFile(filePath, "utf8"));
  const parsed = installedClientSchema.safeParse(raw);

  if (!parsed.success) {
    throw new OAuthClientConfigError(`Invalid installed app credentials JSON: ${parsed.error.message}`);
  }

  return {
    clientId: parsed.data.installed.client_id,
    clientSecret: parsed.data.installed.client_secret,
    redirectUris: parsed.data.installed.redirect_uris,
  };
}

export async function loadStoredOAuthClient(configPath: string): Promise<OAuthClientConfig> {
  const raw = JSON.parse(await readFile(configPath, "utf8"));
  const parsed = normalizedClientSchema.safeParse(raw);

  if (!parsed.success) {
    throw new OAuthClientConfigError(`Invalid stored OAuth client config: ${parsed.error.message}`);
  }

  return parsed.data;
}

export async function saveOAuthClientConfig(configPath: string, config: OAuthClientConfig): Promise<void> {
  const serialized = `${JSON.stringify(config, null, 2)}\n`;
  await writeFile(configPath, serialized, { encoding: "utf8", mode: 0o600 });

  if (process.platform !== "win32") {
    await import("node:fs/promises").then(({ chmod }) => chmod(configPath, 0o600));
  }
}

export async function resolveLoginOAuthClient(options: {
  credentialsPath?: string;
  configPath: string;
}): Promise<ResolvedOAuthClient> {
  if (options.credentialsPath) {
    const resolvedPath = path.resolve(options.credentialsPath);
    return {
      ...(await normalizeOAuthClientFile(resolvedPath)),
      source: "cli",
      sourcePath: resolvedPath,
    };
  }

  const envPath = process.env.GOOGLE_OAUTH_CLIENT_SECRET_PATH;
  if (envPath) {
    const resolvedPath = path.resolve(envPath);
    return {
      ...(await normalizeOAuthClientFile(resolvedPath)),
      source: "env",
      sourcePath: resolvedPath,
    };
  }

  if (await fileExists(options.configPath)) {
    return {
      ...(await loadStoredOAuthClient(options.configPath)),
      source: "stored",
      sourcePath: options.configPath,
    };
  }

  throw new OAuthClientConfigError(
    "OAuth client credentials are required. Provide --credentials <path> or set GOOGLE_OAUTH_CLIENT_SECRET_PATH before the first login.",
  );
}

export async function resolveRegisteredOAuthClient(configPath: string): Promise<OAuthClientConfig> {
  if (!(await fileExists(configPath))) {
    throw new OAuthClientConfigError("Registered OAuth client not found. Run `login` first.");
  }

  return loadStoredOAuthClient(configPath);
}
