import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuthOptions, createPasswordAuthStore } from "@ssakmail/auth";

const passwordStore = async () => {
  const { env } = await getCloudflareContext({ async: true });
  return createPasswordAuthStore(env.PREFERENCES_DB);
};

export const authOptions = createAuthOptions({
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
});
