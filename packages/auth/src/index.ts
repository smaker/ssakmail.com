import {
  IMAP_DEFAULT_PORT,
  type ImapCredentials,
  isValidImapHost,
  isValidImapPort,
  verifyImapCredentials,
} from "@ssakmail/mail";
import axios from "axios";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import {
  PASSWORD_PROVIDER_ID,
  type PasswordAuthStore,
  validatePasswordCredentials,
  verifyPassword,
} from "./password";

export type {
  PasswordAuthStore,
  PasswordAuthUser,
  PasswordDatabase,
} from "./password";
export {
  allowPasswordSignup,
  createPasswordAccount,
  createPasswordAuthStore,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PROVIDER_ID,
  passwordError,
  passwordUserFromRow,
  validatePasswordCredentials,
  verifyPassword,
} from "./password";

export type OAuthMailProvider = "google" | "microsoft";
export type MailTokenProvider = OAuthMailProvider | "imap";
export const IMAP_PROVIDER_ID = "imap";

export const GMAIL_SCOPE = "https://mail.google.com/";
export const GRAPH_MAIL_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
export const IDENTITY_SCOPE = "openid email profile";
export const MICROSOFT_IDENTITY_SCOPE = `${IDENTITY_SCOPE} offline_access`;

export const MAIL_SCOPE: Record<OAuthMailProvider, string> = {
  google: GMAIL_SCOPE,
  microsoft: GRAPH_MAIL_SCOPE,
};

export const authorizationScope = (provider: OAuthMailProvider) =>
  provider === "google"
    ? `${IDENTITY_SCOPE} ${GMAIL_SCOPE}`
    : `${MICROSOFT_IDENTITY_SCOPE} ${GRAPH_MAIL_SCOPE}`;

export type MailToken = JWT & {
  /** Stable D1 identity for password accounts; OAuth keeps the legacy email key. */
  identityKey?: string;
  provider?: MailTokenProvider;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  /**
   * IMAP has no token to refresh, so the app password lives in the NextAuth
   * JWT, which is encrypted with AUTH_SECRET and only ever read server side.
   */
  imap?: ImapCredentials;
  error?: "RefreshAccessTokenError";
};

/** Kept for callers written before Microsoft support landed. */
export type GoogleToken = MailToken;

const GRAPH_SCOPE_PREFIX = "https://graph.microsoft.com/";

/**
 * Microsoft returns granted scopes either fully qualified or bare, so both
 * spellings have to count as the same permission.
 */
const normalizeScope = (scope: string) =>
  scope.startsWith(GRAPH_SCOPE_PREFIX)
    ? scope.slice(GRAPH_SCOPE_PREFIX.length)
    : scope;

export const hasMailScope = (
  provider: OAuthMailProvider,
  scope?: string,
): boolean => {
  const required = normalizeScope(MAIL_SCOPE[provider]);
  return (
    scope?.split(" ").some((granted) => normalizeScope(granted) === required) ??
    false
  );
};

export const hasGmailScope = (scope?: string) => hasMailScope("google", scope);

export type AuthorizedMailToken =
  | { status: 401 | 403 }
  | {
      status: 200;
      credentials:
        | { provider: OAuthMailProvider; accessToken: string }
        | ({ provider: "imap" } & ImapCredentials);
      provider: MailTokenProvider;
    };

export const authorizeMailToken = (
  token: MailToken | null,
): AuthorizedMailToken => {
  if (!token || token.error) return { status: 401 };
  if (token.provider === "imap") {
    if (!token.imap) return { status: 401 };
    return {
      status: 200,
      provider: "imap",
      credentials: { provider: "imap", ...token.imap },
    };
  }
  const provider = token.provider ?? "google";
  if (!token.accessToken) return { status: 401 };
  if (!hasMailScope(provider, token.scope)) return { status: 403 };
  return {
    status: 200,
    provider,
    credentials: { provider, accessToken: token.accessToken },
  };
};

/** Kept for callers written before Microsoft support landed. */
export const authorizeGoogleToken = (token: MailToken | null) => {
  const authorized = authorizeMailToken(token);
  return authorized.status === 200 && authorized.credentials.provider !== "imap"
    ? {
        status: authorized.status,
        accessToken: authorized.credentials.accessToken,
      }
    : { status: authorized.status };
};

const microsoftTenant = () => process.env.MICROSOFT_TENANT_ID ?? "common";

const refreshEndpoint = (provider: OAuthMailProvider) =>
  provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/token`;

const clientCredentials = (provider: OAuthMailProvider) =>
  provider === "google"
    ? {
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      }
    : {
        client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
      };

export async function refreshMailToken(token: MailToken): Promise<MailToken> {
  const provider = token.provider === "microsoft" ? "microsoft" : "google";
  try {
    if (!token.refreshToken) throw new Error("Missing refresh token");

    const body = new URLSearchParams({
      ...clientCredentials(provider),
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      // Microsoft only re-issues the scopes that the refresh request asks for.
      ...(provider === "microsoft"
        ? { scope: authorizationScope("microsoft") }
        : {}),
    });
    const { data } = await axios.post<{
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      scope?: string;
    }>(refreshEndpoint(provider), body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return {
      ...token,
      provider,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token ?? token.refreshToken,
      scope: data.scope ?? token.scope,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

/** Kept for callers written before Microsoft support landed. */
export const refreshGoogleToken = refreshMailToken;

export const isProviderConfigured = (provider: OAuthMailProvider) =>
  provider === "google"
    ? Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    : Boolean(
        process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
      );

export const readImapCredentials = (
  credentials: Record<string, string> | undefined,
): ImapCredentials | undefined => {
  const host = credentials?.host?.trim() ?? "";
  const user = credentials?.email?.trim() ?? "";
  const password = credentials?.password ?? "";
  const port = Number(credentials?.port || IMAP_DEFAULT_PORT);
  if (!isValidImapHost(host) || !isValidImapPort(port)) return undefined;
  if (!user.includes("@") || !password) return undefined;
  return { host, port, user, password };
};

export function createAuthOptions(
  dependencies: { passwordStore?: PasswordAuthStore } = {},
): NextAuthOptions {
  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        authorization: { params: { scope: IDENTITY_SCOPE } },
      }),
      // Registered only when configured so the sign-in UI never offers a
      // provider that cannot complete the flow.
      ...(isProviderConfigured("microsoft")
        ? [
            AzureADProvider({
              clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
              clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
              tenantId: microsoftTenant(),
              authorization: { params: { scope: MICROSOFT_IDENTITY_SCOPE } },
            }),
          ]
        : []),
      CredentialsProvider({
        id: PASSWORD_PROVIDER_ID,
        name: "싹메일 계정",
        credentials: {
          email: { label: "이메일", type: "email" },
          password: { label: "비밀번호", type: "password" },
        },
        async authorize(credentials) {
          if (!dependencies.passwordStore) return null;
          const validated = validatePasswordCredentials({
            email: credentials?.email ?? "",
            password: credentials?.password ?? "",
          });
          if ("error" in validated) return null;
          const store = dependencies.passwordStore;
          if (
            store.isRateLimited &&
            (await store.isRateLimited(validated.email))
          )
            return null;
          const user = await store.findByEmail(validated.email);
          if (!user) return null;
          if (!(await verifyPassword(validated.password, user))) {
            if (store.recordFailure) await store.recordFailure(validated.email);
            return null;
          }
          if (store.clearFailures) await store.clearFailures(validated.email);
          return { id: user.id, email: user.email, name: user.name };
        },
      }),
      CredentialsProvider({
        id: IMAP_PROVIDER_ID,
        name: "IMAP 메일 계정",
        credentials: {
          host: { label: "IMAP 서버", type: "text" },
          port: { label: "포트", type: "text" },
          email: { label: "메일 주소", type: "text" },
          password: { label: "앱 비밀번호", type: "password" },
        },
        async authorize(credentials) {
          const imap = readImapCredentials(credentials);
          if (!imap) return null;
          await verifyImapCredentials(imap);
          return { id: imap.user, email: imap.user, name: imap.user, imap };
        },
      }),
    ],
    secret: process.env.AUTH_SECRET,
    session: { strategy: "jwt" },
    callbacks: {
      async jwt({ token, account, user }) {
        const mailToken = token as MailToken;
        if (account?.provider === PASSWORD_PROVIDER_ID)
          return {
            ...mailToken,
            identityKey:
              (user as { id?: string } | undefined)?.id ??
              mailToken.identityKey,
            error: undefined,
          };
        if (account?.provider === IMAP_PROVIDER_ID) {
          const imap = (user as { imap?: ImapCredentials } | undefined)?.imap;
          return {
            ...mailToken,
            provider: "imap" as const,
            imap,
            error: undefined,
          };
        }
        if (account) {
          return {
            ...mailToken,
            provider:
              account.provider === "azure-ad"
                ? ("microsoft" as const)
                : ("google" as const),
            accessToken: account.access_token,
            refreshToken: account.refresh_token ?? mailToken.refreshToken,
            expiresAt: account.expires_at
              ? account.expires_at * 1000
              : undefined,
            scope: account.scope,
            error: undefined,
          };
        }
        if (
          mailToken.provider === "imap" ||
          !mailToken.expiresAt ||
          Date.now() < mailToken.expiresAt - 60_000
        )
          return mailToken;
        return refreshMailToken(mailToken);
      },
      async session({ session, token }) {
        const mailToken = token as MailToken;
        const provider = mailToken.provider ?? "google";
        const mailSession = session as typeof session & {
          gmail: {
            connected: boolean;
            provider: MailTokenProvider;
            host?: string;
            error?: "RefreshAccessTokenError";
          };
        };
        mailSession.gmail = {
          connected:
            provider === "imap"
              ? Boolean(mailToken.imap)
              : hasMailScope(provider, mailToken.scope),
          provider,
          // The password never leaves the server; the host is safe to show.
          host: mailToken.imap?.host,
          error: mailToken.error,
        };
        return mailSession;
      },
    },
  };
}
