import { createMailClient, type MailClient, MailError } from "@ssakmail/mail";
import type { NextRequest } from "next/server";
import { mailSession } from "./mail-session";

export const connectionErrorMessage = (status: 401 | 403) =>
  status === 401 ? "로그인이 필요합니다." : "메일 계정 연결이 필요합니다.";

export async function mailRoute<T>(
  request: NextRequest,
  action: (mail: MailClient) => Promise<T>,
) {
  const session = await mailSession(request);
  if (session.status !== 200)
    return Response.json(
      { error: connectionErrorMessage(session.status) },
      { status: session.status },
    );
  try {
    const result = await action(await createMailClient(session.credentials));
    return result === undefined
      ? new Response(null, { status: 204 })
      : Response.json(result);
  } catch (error) {
    const mailError =
      error instanceof MailError
        ? error
        : new MailError(502, "메일 요청을 처리하지 못했습니다.");
    return Response.json(
      { error: mailError.message },
      { status: mailError.status },
    );
  }
}
