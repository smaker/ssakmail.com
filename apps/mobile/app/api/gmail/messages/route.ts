import { listMessages } from "@ssakmail/gmail";
import { filterUnwantedMessages } from "@ssakmail/preference/cloudflare";
import type { NextRequest } from "next/server";
import { preferenceGmailRoute } from "../../../../lib/preference-route";

export async function GET(request: NextRequest) {
  return preferenceGmailRoute(request, async (env, email, accessToken) =>
    filterUnwantedMessages(env, email, await listMessages(accessToken)),
  );
}
