import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authorizeMailToken, type MailToken } from "@ssakmail/auth";
import { createMailClient, type MailClient, MailError } from "@ssakmail/mail";
import type { PreferenceEnv } from "@ssakmail/preference/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectionErrorMessage } from "./mail-route";

async function context(request: NextRequest) {
  const token = (await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })) as MailToken | null;
  if (!token?.email)
    return {
      response: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  const { env } = await getCloudflareContext({ async: true });
  return {
    token,
    email: token.identityKey ?? token.email,
    env: env as unknown as PreferenceEnv,
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
    if (session.response) return session.response;
    return NextResponse.json(await handler(session.env, session.email));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function preferenceMailRoute<T>(
  request: NextRequest,
  handler: (env: PreferenceEnv, email: string, mail: MailClient) => Promise<T>,
) {
  try {
    const session = await context(request);
    if (session.response) return session.response;
    const authorized = authorizeMailToken(session.token);
    if (authorized.status !== 200)
      return NextResponse.json(
        { error: connectionErrorMessage(authorized.status) },
        { status: authorized.status },
      );
    return NextResponse.json(
      await handler(
        session.env,
        session.email,
        await createMailClient(authorized.credentials),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
