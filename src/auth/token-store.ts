import keytar from "keytar";
import type { Credentials } from "google-auth-library";

const SERVICE_NAME = "classroom-backup-google-oauth";

export interface StoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
}

export interface TokenStore {
  load(accountKey: string): Promise<StoredTokens | null>;
  save(accountKey: string, tokens: Credentials): Promise<void>;
  clear(accountKey: string): Promise<void>;
}

export class SecureTokenStoreError extends Error {}

export class KeytarTokenStore implements TokenStore {
  async load(accountKey: string): Promise<StoredTokens | null> {
    try {
      const value = await keytar.getPassword(SERVICE_NAME, accountKey);
      return value ? (JSON.parse(value) as StoredTokens) : null;
    } catch (error) {
      throw new SecureTokenStoreError(`Unable to read tokens from secure storage: ${String(error)}`);
    }
  }

  async save(accountKey: string, tokens: Credentials): Promise<void> {
    const serialized: StoredTokens = {
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
      expiry_date: tokens.expiry_date ?? null,
    };

    try {
      await keytar.setPassword(SERVICE_NAME, accountKey, JSON.stringify(serialized));
    } catch (error) {
      throw new SecureTokenStoreError(`Secure token storage is unavailable: ${String(error)}`);
    }
  }

  async clear(accountKey: string): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, accountKey);
    } catch (error) {
      throw new SecureTokenStoreError(`Unable to clear tokens from secure storage: ${String(error)}`);
    }
  }
}

export function createTokenStore(): TokenStore {
  return new KeytarTokenStore();
}
