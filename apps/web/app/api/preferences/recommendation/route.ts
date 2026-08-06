import { recommendMessage } from "@ssakmail/preference/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { preferenceMailRoute } from "../../../../lib/preference-route";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    messageId?: unknown;
  } | null;
  if (typeof body?.messageId !== "string" || !body.messageId)
    return NextResponse.json(
      { error: "메일 ID가 필요합니다." },
      { status: 400 },
    );
  return preferenceMailRoute(request, async (env, email, mail) =>
    recommendMessage(
      env,
      email,
      await mail.getMessage(body.messageId as string),
    ),
  );
}
