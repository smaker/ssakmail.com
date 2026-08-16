import { createMailClient, type MailClient, MailError } from "@ssakmail/mail";
import type { NextRequest } from "next/server";
import { mailSession } from "./mail-session";

export async function mailRoute<T>(
  request: NextRequest,
  action: (mail: MailClient) => Promise<T>,
) {
  const session = await mailSession(request);
  if (!("credentials" in session)) return session.response;
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
