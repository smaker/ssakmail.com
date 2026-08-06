import { MailError } from "@ssakmail/mail";
import { autoOrganizeMessages } from "@ssakmail/preference";
import {
  filterUnwantedMessages,
  getAutoOrganizeExcludedIds,
  getConsent,
  recommendMessageForConsentedUser,
} from "@ssakmail/preference/cloudflare";
import type { NextRequest } from "next/server";
import { preferenceMailRoute } from "../../../../lib/preference-route";

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  return preferenceMailRoute(request, async (env, email, mail) => {
    const page = await mail.listInbox(cursor);
    const messages = await filterUnwantedMessages(env, email, page.messages);
    const consent = await getConsent(env, email);
    const excludedIds =
      consent.consented && consent.autoOrganizeEnabled
        ? await getAutoOrganizeExcludedIds(env, email, messages)
        : new Set<string>();
    return {
      messages: await autoOrganizeMessages(
        messages,
        {
          enabled: consent.consented && consent.autoOrganizeEnabled,
          confidenceThreshold: consent.autoOrganizeConfidenceThreshold,
        },
        async (message) => {
          if (excludedIds.has(message.id)) return undefined;
          return (
            await recommendMessageForConsentedUser(
              env,
              email,
              await mail.getMessage(message.id),
            )
          ).recommendation;
        },
        async (id) => {
          if ((await getAutoOrganizeExcludedIds(env, email, [{ id }])).has(id))
            return false;
          if (!(await mail.moveToAutoOrganized(id))) return false;
          // The user may have restored the message while the move was running.
          if (
            (await getAutoOrganizeExcludedIds(env, email, [{ id }])).has(id)
          ) {
            await mail.restoreFromAutoOrganized(id);
            return false;
          }
          return true;
        },
        (error) =>
          !(error instanceof MailError) ||
          (error.status !== 401 &&
            error.status !== 403 &&
            error.status !== 429),
      ),
      nextCursor: page.nextCursor,
    };
  });
}
