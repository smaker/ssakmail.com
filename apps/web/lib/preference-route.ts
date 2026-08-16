import { createMailClient, type MailClient, MailError } from "@ssakmail/mail";
import type { PreferenceEnv } from "@ssakmail/preference/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { accountSession, mailSession } from "./mail-session";

async function context(request: NextRequest) {
  const session = await accountSession(request);
  if (!("token" in session)) return session;
  return {
    ...session,
    email: session.accountKey,
    env: session.env as unknown as PreferenceEnv,
  };
}

const errorResponse = (error: unknown) =>
  error instanceof MailError
    ? NextResponse.json({ error: error.message }, { status: error.status })
    : NextResponse.json(
        { error: "선호도 요청을 처리하지 못했습니다." },
        { status: 502 },
      );

export async function preferenceRoute<T>(
  request: NextRequest,
  handler: (env: PreferenceEnv, email: string) => Promise<T>,
) {
  try {
    const session = await context(request);
    if ("response" in session) return session.response;
    return NextResponse.json(await handler(session.env, session.email));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function preferenceMailRoute<T>(
  request: NextRequest,
  handler: (
    env: PreferenceEnv,
    email: string,
    mail: MailClient,
    connectionId: string,
  ) => Promise<T>,
) {
  try {
    const session = await mailSession(request);
    if ("response" in session) return session.response;
    return NextResponse.json(
      await handler(
        session.env as unknown as PreferenceEnv,
        session.accountKey,
        await createMailClient(session.credentials),
        session.connection.id,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
