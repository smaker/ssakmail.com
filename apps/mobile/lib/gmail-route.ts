import { GmailError } from "@ssakmail/gmail";
import type { NextRequest } from "next/server";
import { gmailSession } from "./gmail-session";

export async function gmailRoute<T>(
  request: NextRequest,
  action: (accessToken: string) => Promise<T>,
) {
  const session = await gmailSession(request);
  if (session.status !== 200) {
    return Response.json(
      {
        error:
          session.status === 401
            ? "Google 로그인이 필요합니다."
            : "Gmail 연결이 필요합니다.",
      },
      { status: session.status },
    );
  }
  try {
    const result = await action(session.accessToken);
    return result === undefined
      ? new Response(null, { status: 204 })
      : Response.json(result);
  } catch (error) {
    const gmailError =
      error instanceof GmailError
        ? error
        : new GmailError(502, "Gmail 요청을 처리하지 못했습니다.");
    return Response.json(
      { error: gmailError.message },
      { status: gmailError.status },
    );
  }
}
