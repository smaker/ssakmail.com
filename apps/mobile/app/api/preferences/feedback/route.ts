import type { FeedbackAction } from "@ssakmail/preference";
import { recordFeedback } from "@ssakmail/preference/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { preferenceMailRoute } from "../../../../lib/preference-route";

const actions = new Set<FeedbackAction>([
  "preferred",
  "unwanted",
  "kept",
  "trashed",
  "deleted",
]);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    messageId?: unknown;
    action?: unknown;
  } | null;
  if (
    typeof body?.messageId !== "string" ||
    !body.messageId ||
    typeof body.action !== "string" ||
    !actions.has(body.action as FeedbackAction)
  )
    return NextResponse.json(
      { error: "유효한 피드백이 필요합니다." },
      { status: 400 },
    );
  return preferenceMailRoute(request, async (env, email, mail, connectionId) =>
    recordFeedback(
      env,
      email,
      {
        ...(await mail.getMessage(body.messageId as string)),
        preferenceKey: `${connectionId}:${body.messageId as string}`,
      },
      body.action as FeedbackAction,
    ),
  );
}
