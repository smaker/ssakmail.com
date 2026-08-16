import { type NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_MAIL_CONNECTION_COOKIE,
  accountSession,
} from "../../../../../lib/mail-session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await accountSession(request);
  if (!("token" in session)) return session.response;
  const { id } = await context.params;
  const connection = await session.store.get(session.accountKey, id);
  if (!connection)
    return NextResponse.json(
      { error: "메일 계정을 찾지 못했습니다." },
      { status: 404 },
    );
  const response = NextResponse.json({
    connection: {
      id: connection.id,
      provider: connection.provider,
      mailboxAddress: connection.mailboxAddress,
      displayName: connection.displayName,
      connectedAt: connection.connectedAt,
    },
  });
  response.cookies.set(ACTIVE_MAIL_CONNECTION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
