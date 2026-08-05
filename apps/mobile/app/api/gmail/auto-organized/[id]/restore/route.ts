import {
  findLabel,
  GmailError,
  restoreFromAutoOrganizedLabel,
} from "@ssakmail/gmail";
import { excludeMessageFromAutoOrganize } from "@ssakmail/preference/cloudflare";
import type { NextRequest } from "next/server";
import { preferenceGmailRoute } from "../../../../../../lib/preference-route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return preferenceGmailRoute(request, async (env, email, accessToken) => {
    const label = await findLabel(accessToken);
    if (!label?.id) throw new GmailError(404, "자동정리함을 찾지 못했습니다.");
    await excludeMessageFromAutoOrganize(env, email, id);
    await restoreFromAutoOrganizedLabel(accessToken, id, label.id);
  });
}
