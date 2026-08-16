import { type NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_MAIL_CONNECTION_COOKIE,
  accountSession,
} from "../../../../lib/mail-session";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await accountSession(request);
  if (!("token" in session)) return session.response;
  const { id } = await context.params;
  const deleted = await session.store.delete(session.accountKey, id);
  if (!deleted)
    return NextResponse.json(
      { error: "메일 계정을 찾지 못했습니다." },
      { status: 404 },
    );
  const response = new NextResponse(null, { status: 204 });
  if (
    request.headers
      .get("Cookie")
      ?.includes(`${ACTIVE_MAIL_CONNECTION_COOKIE}=${id}`)
  )
    response.cookies.delete(ACTIVE_MAIL_CONNECTION_COOKIE);
  return response;
}
