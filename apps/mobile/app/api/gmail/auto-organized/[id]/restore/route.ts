import { MailError } from "@ssakmail/mail";
import { excludeMessageFromAutoOrganize } from "@ssakmail/preference/cloudflare";
import type { NextRequest } from "next/server";
import { preferenceMailRoute } from "../../../../../../lib/preference-route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return preferenceMailRoute(request, async (env, email, mail) => {
    await excludeMessageFromAutoOrganize(env, email, id);
    if (!(await mail.restoreFromAutoOrganized(id)))
      throw new MailError(404, "자동정리함에서 메일을 복원하지 못했습니다.");
  });
}
