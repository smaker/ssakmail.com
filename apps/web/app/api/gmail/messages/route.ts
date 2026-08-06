import {
  GmailError,
  getMessage,
  getOrCreateLabel,
  listMessages,
  moveToAutoOrganizedLabel,
  restoreFromAutoOrganizedLabel,
} from "@ssakmail/gmail";
import { autoOrganizeMessages } from "@ssakmail/preference";
import {
  filterUnwantedMessages,
  getAutoOrganizeExcludedIds,
  getConsent,
  recommendMessageForConsentedUser,
} from "@ssakmail/preference/cloudflare";
import type { NextRequest } from "next/server";
import { preferenceGmailRoute } from "../../../../lib/preference-route";

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  return preferenceGmailRoute(request, async (env, email, accessToken) => {
    const page = await listMessages(accessToken, undefined, cursor);
    const messages = await filterUnwantedMessages(env, email, page.messages);
    const consent = await getConsent(env, email);
    const excludedIds =
      consent.consented && consent.autoOrganizeEnabled
        ? await getAutoOrganizeExcludedIds(env, email, messages)
        : new Set<string>();
    let labelPromise: ReturnType<typeof getOrCreateLabel> | undefined;
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
              await getMessage(accessToken, message.id),
            )
          ).recommendation;
        },
        async (id) => {
          if ((await getAutoOrganizeExcludedIds(env, email, [{ id }])).has(id))
            return false;
          if (!labelPromise) labelPromise = getOrCreateLabel(accessToken);
          const labelId = (await labelPromise).id;
          if (!labelId) return false;
          const labels = await moveToAutoOrganizedLabel(
            accessToken,
            id,
            labelId,
          );
          const moved = labels.includes(labelId) && !labels.includes("INBOX");
          if (
            moved &&
            (await getAutoOrganizeExcludedIds(env, email, [{ id }])).has(id)
          ) {
            await restoreFromAutoOrganizedLabel(accessToken, id, labelId);
            return false;
          }
          return moved;
        },
        (error) =>
          !(error instanceof GmailError) ||
          (error.status !== 401 &&
            error.status !== 403 &&
            error.status !== 429),
      ),
      nextCursor: page.nextCursor,
    };
  });
}
