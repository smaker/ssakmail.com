export const PASSWORD_PROVIDER_ID = "password";
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_MAX_FAILURES = 5;
const SIGNUP_RATE_WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_MAX_ATTEMPTS = 5;

export type PasswordAuthUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
};

export type PasswordAuthStore = {
  findByEmail: (email: string) => Promise<PasswordAuthUser | null>;
  isRateLimited?: (email: string) => Promise<boolean>;
  recordFailure?: (email: string) => Promise<void>;
  clearFailures?: (email: string) => Promise<void>;
};

type PasswordDatabaseStatement = {
  bind: (...values: Array<string | number | null>) => PasswordDatabaseStatement;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type PasswordDatabase = {
  prepare: (query: string) => PasswordDatabaseStatement;
};

type PasswordRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};

type LoginRateLimitRow = {
  failure_count: number;
  window_started_at: number;
  blocked_until: number | null;
};

const changedRows = (result: unknown) => {
  if (!result || typeof result !== "object" || !("meta" in result)) return 0;
  const meta = (result as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object" || !("changes" in meta)) return 0;
  const changes = (meta as { changes?: unknown }).changes;
  return typeof changes === "number" ? changes : 0;
};

const textEncoder = new TextEncoder();

const asArrayBuffer = (bytes: Uint8Array) =>
  bytes.slice().buffer as ArrayBuffer;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const derivePasswordHash = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
) => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: asArrayBuffer(salt),
      iterations,
    },
    key,
    PASSWORD_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
};

const sameBytes = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index];
  return difference === 0;
};

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const isValidEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const passwordError = (password: string) => {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해주세요.`;
  if (password.length > PASSWORD_MAX_LENGTH)
    return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하로 입력해주세요.`;
  return undefined;
};

export const validatePasswordCredentials = (input: {
  email: string;
  password: string;
  name?: string;
}) => {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email))
    return { error: "올바른 이메일 주소를 입력해주세요." };
  const error = passwordError(input.password);
  if (error) return { error };
  const name = input.name?.trim() || email.split("@")[0];
  if (name.length > 80) return { error: "이름은 80자 이하로 입력해주세요." };
  return { email, password: input.password, name };
};

export async function hashPassword(password: string) {
  const salt = new Uint8Array(PASSWORD_SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  return {
    hash: bytesToBase64(hash),
    salt: bytesToBase64(salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  stored: Pick<
    PasswordAuthUser,
    "passwordHash" | "passwordSalt" | "passwordIterations"
  >,
) {
  if (
    !Number.isSafeInteger(stored.passwordIterations) ||
    stored.passwordIterations < 10_000 ||
    stored.passwordIterations > 1_000_000
  )
    return false;
  try {
    const expected = base64ToBytes(stored.passwordHash);
    const actual = await derivePasswordHash(
      password,
      base64ToBytes(stored.passwordSalt),
      stored.passwordIterations,
    );
    return sameBytes(actual, expected);
  } catch {
    return false;
  }
}

export const passwordUserFromRow = (row: PasswordRow): PasswordAuthUser => ({
  id: row.id,
  email: row.email,
  name: row.display_name,
  passwordHash: row.password_hash,
  passwordSalt: row.password_salt,
  passwordIterations: row.password_iterations,
});

export const createPasswordAuthStore = (
  db: PasswordDatabase,
): PasswordAuthStore => {
  const rateLimitRow = async (email: string) =>
    db
      .prepare(
        "SELECT failure_count, window_started_at, blocked_until FROM auth_login_attempts WHERE email = ?1 LIMIT 1",
      )
      .bind(normalizeEmail(email))
      .first<LoginRateLimitRow>();

  return {
    async findByEmail(email) {
      const row = await db
        .prepare(
          "SELECT id, email, display_name, password_hash, password_salt, password_iterations FROM auth_users WHERE email = ?1 LIMIT 1",
        )
        .bind(normalizeEmail(email))
        .first<PasswordRow>();
      return row ? passwordUserFromRow(row) : null;
    },
    async isRateLimited(email) {
      const row = await rateLimitRow(email);
      return Boolean(row?.blocked_until && row.blocked_until > Date.now());
    },
    async recordFailure(email) {
      const normalizedEmail = normalizeEmail(email);
      const now = Date.now();
      const cutoff = now - PASSWORD_FAILURE_WINDOW_MS;
      const active = await db
        .prepare(
          "UPDATE auth_login_attempts SET failure_count = failure_count + 1, blocked_until = CASE WHEN failure_count + 1 >= ?3 THEN ?4 ELSE blocked_until END WHERE email = ?1 AND window_started_at > ?2 AND failure_count < ?3",
        )
        .bind(
          normalizedEmail,
          cutoff,
          PASSWORD_MAX_FAILURES,
          now + PASSWORD_FAILURE_WINDOW_MS,
        )
        .run();
      if (changedRows(active) === 1) return;

      const reset = await db
        .prepare(
          "UPDATE auth_login_attempts SET failure_count = 1, window_started_at = ?2, blocked_until = NULL WHERE email = ?1 AND window_started_at <= ?3",
        )
        .bind(normalizedEmail, now, cutoff)
        .run();
      if (changedRows(reset) === 1) return;

      await db
        .prepare(
          "INSERT OR IGNORE INTO auth_login_attempts (email, failure_count, window_started_at, blocked_until) VALUES (?1, 1, ?2, NULL)",
        )
        .bind(normalizedEmail, now)
        .run();
    },
    async clearFailures(email) {
      await db
        .prepare("DELETE FROM auth_login_attempts WHERE email = ?1")
        .bind(normalizeEmail(email))
        .run();
    },
  };
};

const hashRateLimitKey = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(`ssakmail-signup:${value}`),
  );
  return bytesToBase64(new Uint8Array(digest));
};

export const allowPasswordSignup = async (
  db: PasswordDatabase,
  source: string,
) => {
  const key = await hashRateLimitKey(source);
  const now = Date.now();
  const cutoff = now - SIGNUP_RATE_WINDOW_MS;
  const active = await db
    .prepare(
      "UPDATE auth_signup_rate_limits SET attempts = attempts + 1 WHERE source_key = ?1 AND window_started_at > ?2 AND attempts < ?3",
    )
    .bind(key, cutoff, SIGNUP_MAX_ATTEMPTS)
    .run();
  if (changedRows(active) === 1) return true;

  const reset = await db
    .prepare(
      "UPDATE auth_signup_rate_limits SET attempts = 1, window_started_at = ?2 WHERE source_key = ?1 AND window_started_at <= ?3",
    )
    .bind(key, now, cutoff)
    .run();
  if (changedRows(reset) === 1) return true;

  const inserted = await db
    .prepare(
      "INSERT OR IGNORE INTO auth_signup_rate_limits (source_key, attempts, window_started_at) VALUES (?1, 1, ?2)",
    )
    .bind(key, now)
    .run();
  return changedRows(inserted) === 1;
};

export const createPasswordAccount = async (
  db: PasswordDatabase,
  input: { email: string; password: string; name?: string },
) => {
  const validated = validatePasswordCredentials(input);
  if ("error" in validated)
    return { status: "invalid" as const, error: validated.error };

  const existing = await db
    .prepare("SELECT id FROM auth_users WHERE email = ?1 LIMIT 1")
    .bind(validated.email)
    .first<{ id: string }>();
  if (existing) return { status: "exists" as const };

  const password = await hashPassword(validated.password);
  const user = {
    id: crypto.randomUUID(),
    email: validated.email,
    name: validated.name,
    ...password,
  };
  await db
    .prepare(
      "INSERT OR IGNORE INTO auth_users (id, email, display_name, password_hash, password_salt, password_iterations, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(
      user.id,
      user.email,
      user.name,
      user.hash,
      user.salt,
      user.iterations,
      new Date().toISOString(),
    )
    .run();
  const inserted = await db
    .prepare("SELECT id FROM auth_users WHERE email = ?1 LIMIT 1")
    .bind(user.email)
    .first<{ id: string }>();
  if (!inserted || inserted.id !== user.id)
    return { status: "exists" as const };
  return { status: "created" as const, user };
};
