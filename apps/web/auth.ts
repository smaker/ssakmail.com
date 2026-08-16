import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  createAuthOptions,
  createMailConnectionStore,
  createPasswordAuthStore,
  MAIL_CONNECTION_INTENT_COOKIE,
  type MailToken,
  verifyMailConnectionIntent,
} from "@ssakmail/auth";
import { cookies, headers } from "next/headers";
import { getToken } from "next-auth/jwt";

const passwordStore = async () => {
  const { env } = await getCloudflareContext({ async: true });
  return createPasswordAuthStore(env.PREFERENCES_DB);
};
const credentialSecret = () => {
  const value = process.env.MAIL_CREDENTIALS_KEY;
  if (!value) throw new Error("MAIL_CREDENTIALS_KEY is required");
  return value;
};

export const authOptions = createAuthOptions({
  async resolveConnectionIdentity(provider) {
    const value = (await cookies()).get(MAIL_CONNECTION_INTENT_COOKIE)?.value;
    const requested = await verifyMailConnectionIntent(
      value,
      process.env.AUTH_SECRET ?? "",
      provider,
    );
    if (!requested) return undefined;
    const current = (await getToken({
      req: { headers: await headers() } as never,
      secret: process.env.AUTH_SECRET,
    })) as MailToken | null;
    if (!current?.email) return undefined;
    const currentKey = current.identityKey ?? current.email.toLowerCase();
    return currentKey === requested.accountKey
      ? {
          accountKey: currentKey,
          email: current.email,
          name: current.name ?? undefined,
        }
      : undefined;
  },
  passwordStore: {
    async findByEmail(email) {
      return (await passwordStore()).findByEmail(email);
    },
    async isRateLimited(email) {
      return (await passwordStore()).isRateLimited?.(email) ?? false;
    },
    async recordFailure(email) {
      await (await passwordStore()).recordFailure?.(email);
    },
    async clearFailures(email) {
      await (await passwordStore()).clearFailures?.(email);
    },
  },
  mailConnectionStore: {
    async list(accountKey) {
      const { env } = await getCloudflareContext({ async: true });
      return createMailConnectionStore(
        env.PREFERENCES_DB,
        credentialSecret(),
      ).list(accountKey);
    },
    async get(accountKey, id) {
      const { env } = await getCloudflareContext({ async: true });
      return createMailConnectionStore(
        env.PREFERENCES_DB,
        credentialSecret(),
      ).get(accountKey, id);
    },
    async save(input, now) {
      const { env } = await getCloudflareContext({ async: true });
      return createMailConnectionStore(
        env.PREFERENCES_DB,
        credentialSecret(),
      ).save(input, now);
    },
    async upsert(input, now) {
      const { env } = await getCloudflareContext({ async: true });
      return createMailConnectionStore(
        env.PREFERENCES_DB,
        credentialSecret(),
      ).upsert(input, now);
    },
    async delete(accountKey, id) {
      const { env } = await getCloudflareContext({ async: true });
      return createMailConnectionStore(
        env.PREFERENCES_DB,
        credentialSecret(),
      ).delete(accountKey, id);
    },
  },
});
