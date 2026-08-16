const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type MailConnectionProvider = "google" | "microsoft" | "imap";
export const MAIL_CONNECTION_INTENT_COOKIE = "ssakmail-connect-intent";
export type MailConnectionCredentials =
  | {
      provider: "google" | "microsoft";
      accessToken: string;
      refreshToken?: string;
      expiresAt?: number;
      scope: string;
    }
  | {
      provider: "imap";
      host: string;
      port: number;
      user: string;
      password: string;
    };

export type MailConnectionInput = {
  accountKey: string;
  provider: MailConnectionProvider;
  providerAccountId: string;
  mailboxAddress: string;
  displayName?: string;
  credentials: MailConnectionCredentials;
};

export type MailConnectionSummary = {
  id: string;
  provider: MailConnectionProvider;
  mailboxAddress: string;
  displayName: string;
  connectedAt: string;
};

export type MailConnection = MailConnectionSummary & {
  providerAccountId: string;
  credentials: MailConnectionCredentials;
};

type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

export type MailConnectionEnv = {
  PREFERENCES_DB: { prepare: (sql: string) => Statement };
  AUTH_SECRET: string;
};

export type MailConnectionStore = {
  list: (accountKey: string) => Promise<MailConnectionSummary[]>;
  get: (accountKey: string, id: string) => Promise<MailConnection | null>;
  save: (
    input: Omit<MailConnectionInput, "accountKey"> & { accountKey: string },
    now?: Date,
  ) => Promise<MailConnectionSummary>;
  upsert: MailConnectionStore["save"];
  delete: (accountKey: string, id: string) => Promise<boolean>;
};

type ConnectionIntent = {
  accountKey: string;
  provider: "google" | "microsoft";
  expiresAt: number;
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const toBase64Url = (value: string) =>
  toBase64(encoder.encode(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value: string) =>
  decoder.decode(fromBase64(value.replace(/-/g, "+").replace(/_/g, "/")));

const intentKey = async (secret: string) => {
  if (!secret) throw new Error("AUTH_SECRET is required");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
};

export async function createMailConnectionIntent(
  accountKey: string,
  authSecret: string,
  provider: "google" | "microsoft",
  now = Date.now(),
  lifetimeMs = 5 * 60_000,
) {
  const payload = toBase64Url(
    JSON.stringify({ accountKey, provider, expiresAt: now + lifetimeMs }),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await intentKey(authSecret),
    encoder.encode(payload),
  );
  return `${payload}.${toBase64(new Uint8Array(signature))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;
}

export async function verifyMailConnectionIntent(
  value: string | undefined,
  authSecret: string,
  provider?: "google" | "microsoft",
  now = Date.now(),
) {
  if (!value) return undefined;
  const parts = value.split(".");
  if (parts.length !== 2) return undefined;
  const [payload, encodedSignature] = parts;
  if (!payload || !encodedSignature) return undefined;
  let valid = false;
  try {
    const signature = fromBase64(
      encodedSignature.replace(/-/g, "+").replace(/_/g, "/"),
    );
    valid = await crypto.subtle.verify(
      "HMAC",
      await intentKey(authSecret),
      signature,
      encoder.encode(payload),
    );
  } catch {
    return undefined;
  }
  if (!valid) return undefined;
  let intent: ConnectionIntent;
  try {
    intent = JSON.parse(fromBase64Url(payload)) as ConnectionIntent;
  } catch {
    return undefined;
  }
  if (
    typeof intent.accountKey !== "string" ||
    !intent.accountKey.trim() ||
    (intent.provider !== "google" && intent.provider !== "microsoft") ||
    typeof intent.expiresAt !== "number" ||
    !Number.isFinite(intent.expiresAt) ||
    intent.expiresAt <= now ||
    (provider && intent.provider !== provider)
  )
    return undefined;
  return intent;
}

const keyFromSecret = async (secret: string) => {
  if (!secret) throw new Error("MAIL_CREDENTIALS_KEY is required");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
};

const connectionIdFor = async (
  accountKey: string,
  provider: MailConnectionProvider,
  providerAccountId: string,
) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${accountKey}\u0000${provider}\u0000${providerAccountId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export async function encryptCredentials(
  credentials: MailConnectionCredentials,
  authSecret: string,
  associatedData = "",
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromSecret(authSecret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(associatedData) },
    key,
    encoder.encode(JSON.stringify(credentials)),
  );
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptCredentials(
  encrypted: string,
  authSecret: string,
  associatedData = "",
): Promise<MailConnectionCredentials> {
  const [version, encodedIv, encodedCiphertext] = encrypted.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext)
    throw new Error("Invalid credentials");
  const key = await keyFromSecret(authSecret);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(encodedIv),
      additionalData: encoder.encode(associatedData),
    },
    key,
    fromBase64(encodedCiphertext),
  );
  const value: unknown = JSON.parse(decoder.decode(plaintext));
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid credentials");
  const record = value as Record<string, unknown>;
  if (
    record.provider !== "google" &&
    record.provider !== "microsoft" &&
    record.provider !== "imap"
  )
    throw new Error("Invalid credentials");
  return value as MailConnectionCredentials;
}

const summary = (row: {
  id: string;
  provider: MailConnectionProvider;
  provider_account_id?: string;
  mailbox_address: string;
  display_name: string;
  connected_at: string;
}): MailConnectionSummary => ({
  id: row.id,
  provider: row.provider,
  mailboxAddress: row.mailbox_address,
  displayName: row.display_name,
  connectedAt: row.connected_at,
});

export async function saveMailConnection(
  env: MailConnectionEnv,
  input: MailConnectionInput,
  now = new Date(),
): Promise<MailConnectionSummary> {
  if (!input.accountKey.trim() || !input.mailboxAddress.trim())
    throw new Error("accountKey and mailboxAddress are required");
  if (!input.providerAccountId.trim())
    throw new Error("providerAccountId is required");
  if (input.credentials.provider !== input.provider)
    throw new Error("credential provider mismatch");
  const providerAccountId = input.providerAccountId.trim();
  const existing = await env.PREFERENCES_DB.prepare(
    `SELECT id FROM mail_connections
     WHERE account_key = ? AND provider = ? AND provider_account_id = ?`,
  )
    .bind(input.accountKey, input.provider, providerAccountId)
    .first<{ id: string }>();
  const row = {
    // Deterministic IDs keep the AAD stable when concurrent upserts race.
    id:
      existing?.id ??
      (await connectionIdFor(
        input.accountKey,
        input.provider,
        providerAccountId,
      )),
    provider: input.provider,
    provider_account_id: providerAccountId,
    mailbox_address: input.mailboxAddress.trim(),
    display_name: input.displayName?.trim() || input.mailboxAddress.trim(),
    connected_at: now.toISOString(),
  };
  await env.PREFERENCES_DB.prepare(
    `INSERT INTO mail_connections
      (id, account_key, provider, provider_account_id, mailbox_address, display_name, credentials_encrypted, connected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_key, provider, provider_account_id) DO UPDATE SET
       display_name = excluded.display_name,
       mailbox_address = excluded.mailbox_address,
       credentials_encrypted = excluded.credentials_encrypted,
       updated_at = excluded.updated_at`,
  )
    .bind(
      row.id,
      input.accountKey,
      row.provider,
      row.provider_account_id,
      row.mailbox_address,
      row.display_name,
      await encryptCredentials(
        input.credentials,
        env.AUTH_SECRET,
        `${input.accountKey}:${row.id}:${row.provider}`,
      ),
      row.connected_at,
      row.connected_at,
    )
    .run();
  const saved = await env.PREFERENCES_DB.prepare(
    `SELECT id, provider, provider_account_id, mailbox_address, display_name, connected_at
     FROM mail_connections
     WHERE account_key = ? AND provider = ? AND provider_account_id = ?`,
  )
    .bind(input.accountKey, row.provider, row.provider_account_id)
    .first<Parameters<typeof summary>[0]>();
  return summary(saved ?? row);
}

export async function listMailConnections(
  env: MailConnectionEnv,
  accountKey: string,
): Promise<MailConnectionSummary[]> {
  const result = await env.PREFERENCES_DB.prepare(
    `SELECT id, provider, provider_account_id, mailbox_address, display_name, connected_at
     FROM mail_connections WHERE account_key = ? ORDER BY connected_at DESC`,
  )
    .bind(accountKey)
    .all<Parameters<typeof summary>[0]>();
  return result.results.map(summary);
}

export async function getMailConnection(
  env: MailConnectionEnv,
  accountKey: string,
  id: string,
): Promise<MailConnection | null> {
  const row = await env.PREFERENCES_DB.prepare(
    `SELECT id, provider, provider_account_id, mailbox_address, display_name, connected_at, credentials_encrypted
     FROM mail_connections WHERE account_key = ? AND id = ?`,
  )
    .bind(accountKey, id)
    .first<Parameters<typeof summary>[0] & { credentials_encrypted: string }>();
  if (!row) return null;
  return {
    ...summary(row),
    providerAccountId: row.provider_account_id ?? "",
    credentials: await decryptCredentials(
      row.credentials_encrypted,
      env.AUTH_SECRET,
      `${accountKey}:${row.id}:${row.provider}`,
    ),
  };
}

export async function deleteMailConnection(
  env: MailConnectionEnv,
  accountKey: string,
  id: string,
): Promise<boolean> {
  const result = (await env.PREFERENCES_DB.prepare(
    "DELETE FROM mail_connections WHERE account_key = ? AND id = ?",
  )
    .bind(accountKey, id)
    .run()) as { meta?: { changes?: number } };
  return (result.meta?.changes ?? 0) > 0;
}

export function createMailConnectionStore(
  db: MailConnectionEnv["PREFERENCES_DB"],
  authSecret: string,
): MailConnectionStore {
  const env = { PREFERENCES_DB: db, AUTH_SECRET: authSecret };
  return {
    list: (accountKey) => listMailConnections(env, accountKey),
    get: (accountKey, id) => getMailConnection(env, accountKey, id),
    save: (input, now) => saveMailConnection(env, input, now),
    upsert: (input, now) => saveMailConnection(env, input, now),
    delete: (accountKey, id) => deleteMailConnection(env, accountKey, id),
  };
}
