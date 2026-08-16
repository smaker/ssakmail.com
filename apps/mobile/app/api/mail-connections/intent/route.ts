import {
  createMailConnectionIntent,
  MAIL_CONNECTION_INTENT_COOKIE,
} from "@ssakmail/auth";
import { type NextRequest, NextResponse } from "next/server";
import { accountSession } from "../../../../lib/mail-session";

export async function POST(request: NextRequest) {
  const session = await accountSession(request);
  if (!("token" in session)) return session.response;
  const body = (await request.json().catch(() => null)) as {
    provider?: unknown;
  } | null;
  const provider = body?.provider;
  if (provider !== "google" && provider !== "microsoft")
    return NextResponse.json(
      { error: "연결할 메일 서비스를 확인해주세요." },
      { status: 400 },
    );
  const value = await createMailConnectionIntent(
    session.accountKey,
    process.env.AUTH_SECRET ?? "",
    provider,
  );
  const response = NextResponse.json({ ok: true });
  response.cookies.set(MAIL_CONNECTION_INTENT_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(MAIL_CONNECTION_INTENT_COOKIE);
  return response;
}
