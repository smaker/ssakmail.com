import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  createMailConnectionStore,
  hasMailScope,
  type MailConnection,
  type MailToken,
  normalizeEmail,
  refreshMailToken,
} from "@ssakmail/auth";
import type { MailCredentials } from "@ssakmail/mail";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export const ACTIVE_MAIL_CONNECTION_COOKIE = "ssakmail-active-connection";
const credentialSecret = () => {
  const value = process.env.MAIL_CREDENTIALS_KEY;
  if (!value) throw new Error("MAIL_CREDENTIALS_KEY is required");
  return value;
};

type ConnectionDatabase = Parameters<typeof createMailConnectionStore>[0];
type AccountEnvironment = { PREFERENCES_DB: ConnectionDatabase };
type AccountSessionError = { response: Response };
type AccountSessionSuccess = {
  token: MailToken;
  accountKey: string;
  store: ReturnType<typeof createMailConnectionStore>;
  env: AccountEnvironment;
};
export type AccountSession = AccountSessionError | AccountSessionSuccess;

export async function accountSession(
  request: NextRequest,
): Promise<AccountSession> {
  const token = (await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })) as MailToken | null;
  if (!token?.email)
    return {
      response: Response.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  const { env } = await getCloudflareContext({ async: true });
  const accountKey = token.identityKey ?? normalizeEmail(token.email);
  const store = createMailConnectionStore(
    env.PREFERENCES_DB,
    credentialSecret(),
  );
  return { token, accountKey, store, env: env as AccountEnvironment };
}

const oauthCredentials = async (
  connection: MailConnection,
  store: ReturnType<typeof createMailConnectionStore>,
  accountKey: string,
): Promise<MailCredentials | { status: 401 | 403 }> => {
  const credentials = connection.credentials;
  const provider = connection.provider;
  if (credentials.provider === "imap") {
    if (
      typeof credentials.host !== "string" ||
      typeof credentials.user !== "string" ||
      typeof credentials.password !== "string" ||
      typeof credentials.port !== "number"
    )
      return { status: 401 };
    return credentials as MailCredentials;
  }
  if (credentials.provider !== provider) return { status: 401 };
  if (typeof credentials.accessToken !== "string") return { status: 401 };
  if (
    typeof credentials.scope !== "string" ||
    !hasMailScope(provider, credentials.scope)
  )
    return { status: 403 };
  let accessToken = credentials.accessToken;
  if (
    typeof credentials.expiresAt === "number" &&
    Date.now() >= credentials.expiresAt - 60_000
  ) {
    if (typeof credentials.refreshToken !== "string") return { status: 401 };
    const refreshed = await refreshMailToken({
      provider,
      accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt,
      scope: credentials.scope,
    });
    if (refreshed.error || !refreshed.accessToken) return { status: 401 };
    accessToken = refreshed.accessToken;
    await store.upsert({
      accountKey,
      provider,
      providerAccountId: connection.providerAccountId,
      mailboxAddress: connection.mailboxAddress,
      displayName: connection.displayName,
      credentials: {
        provider,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
        scope: refreshed.scope ?? "",
      },
    });
  }
  return { provider, accessToken };
};

type MailSessionSuccess = AccountSessionSuccess & {
  connection: MailConnection;
  connections: Awaited<ReturnType<AccountSessionSuccess["store"]["list"]>>;
  credentials: MailCredentials;
  status: 200;
};
export type MailSession = AccountSessionError | MailSessionSuccess;

export async function mailSession(request: NextRequest): Promise<MailSession> {
  const session = await accountSession(request);
  if (!("token" in session)) return session;
  const connections = await session.store.list(session.accountKey);
  if (connections.length === 0)
    return {
      response: Response.json(
        { error: "메일 계정 연결이 필요합니다." },
        { status: 403 },
      ),
    };
  const requestedId = request.nextUrl.searchParams.get("connection");
  if (!requestedId)
    return {
      response: Response.json(
        { error: "메일 연결을 선택해주세요." },
        { status: 400 },
      ),
    };
  const selected = connections.find(
    (connection) => connection.id === requestedId,
  );
  if (!selected)
    return {
      response: Response.json(
        { error: "메일 계정을 찾지 못했습니다." },
        { status: 404 },
      ),
    };
  const connection = await session.store.get(session.accountKey, selected.id);
  if (!connection)
    return {
      response: Response.json(
        { error: "메일 계정을 찾지 못했습니다." },
        { status: 404 },
      ),
    };
  const credentials = await oauthCredentials(
    connection,
    session.store,
    session.accountKey,
  );
  if ("status" in credentials)
    return {
      response: Response.json(
        {
          error:
            credentials.status === 401
              ? "메일 계정을 다시 연결해주세요."
              : "메일 계정 권한이 필요합니다.",
        },
        { status: credentials.status },
      ),
    };
  return {
    ...session,
    connection,
    connections,
    credentials,
    status: 200 as const,
  };
}
