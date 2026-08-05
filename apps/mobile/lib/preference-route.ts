import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authorizeGoogleToken, type GoogleToken } from "@ssakmail/auth";
import { GmailError } from "@ssakmail/gmail";
import type { PreferenceEnv } from "@ssakmail/preference/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

async function context(request: NextRequest) {
  const token = (await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })) as GoogleToken | null;
  if (!token?.email)
    return {
      response: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  const { env } = await getCloudflareContext({ async: true });
  return { token, email: token.email, env: env as unknown as PreferenceEnv };
}

const errorResponse = (error: unknown) =>
  error instanceof GmailError
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

export async function preferenceGmailRoute<T>(
  request: NextRequest,
  handler: (
    env: PreferenceEnv,
    email: string,
    accessToken: string,
  ) => Promise<T>,
) {
  try {
    const session = await context(request);
    if (session.response) return session.response;
    const gmail = authorizeGoogleToken(session.token);
    if (gmail.status !== 200)
      return NextResponse.json(
        {
          error:
            gmail.status === 403
              ? "Gmail 연결이 필요합니다."
              : "로그인이 필요합니다.",
        },
        { status: gmail.status },
      );
    return NextResponse.json(
      await handler(session.env, session.email, gmail.accessToken),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
