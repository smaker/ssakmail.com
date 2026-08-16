import { readImapCredentials } from "@ssakmail/auth";
import { ImapError, verifyImapCredentials } from "@ssakmail/mail";
import { type NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_MAIL_CONNECTION_COOKIE,
  accountSession,
} from "../../../lib/mail-session";

const formValues = (body: unknown) => {
  if (!body || typeof body !== "object") return {};
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === "string" ? value : "",
    ]),
  );
};

export async function GET(request: NextRequest) {
  const session = await accountSession(request);
  if (!("token" in session)) return session.response;
  const connections = await session.store.list(session.accountKey);
  const requested = request.headers
    .get("Cookie")
    ?.match(new RegExp(`${ACTIVE_MAIL_CONNECTION_COOKIE}=([^;]+)`))?.[1];
  const activeId =
    connections.find((connection) => connection.id === requested)?.id ??
    connections[0]?.id;
  return NextResponse.json({ connections, activeId });
}

export async function POST(request: NextRequest) {
  const session = await accountSession(request);
  if (!("token" in session)) return session.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "메일 연결 정보를 확인해주세요." },
      { status: 400 },
    );
  }
  const imap = readImapCredentials(formValues(body));
  if (!imap)
    return NextResponse.json(
      { error: "IMAP 연결 정보를 확인해주세요." },
      { status: 400 },
    );
  try {
    await verifyImapCredentials(imap);
  } catch (error) {
    if (error instanceof ImapError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error("IMAP verification failed", error);
    return NextResponse.json(
      { error: "메일 서버 연결을 확인하지 못했습니다." },
      { status: 502 },
    );
  }
  try {
    const connection = await session.store.upsert({
      accountKey: session.accountKey,
      provider: "imap",
      providerAccountId: `${imap.host}:${imap.port}:${imap.user.toLowerCase()}`,
      mailboxAddress: imap.user,
      displayName: imap.user,
      credentials: { provider: "imap", ...imap },
    });
    const response = NextResponse.json({ connection }, { status: 201 });
    response.cookies.set(ACTIVE_MAIL_CONNECTION_COOKIE, connection.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    console.error("IMAP connection persistence failed", error);
    return NextResponse.json(
      { error: "메일 연결을 저장하지 못했습니다." },
      { status: 503 },
    );
  }
}
