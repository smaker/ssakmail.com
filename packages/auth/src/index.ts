import axios from "axios";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import AzureADProvider from "next-auth/providers/azure-ad";
import GoogleProvider from "next-auth/providers/google";

export type OAuthMailProvider = "google" | "microsoft";

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
  provider?: OAuthMailProvider;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
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

export const authorizeMailToken = (token: MailToken | null) => {
  const provider = token?.provider ?? "google";
  if (!token?.accessToken || token.error) return { status: 401 as const };
  if (!hasMailScope(provider, token.scope)) return { status: 403 as const };
  return { status: 200 as const, accessToken: token.accessToken, provider };
};

/** Kept for callers written before Microsoft support landed. */
export const authorizeGoogleToken = (token: MailToken | null) => {
  const authorized = authorizeMailToken(token);
  return authorized.status === 200
    ? { status: authorized.status, accessToken: authorized.accessToken }
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
  const provider = token.provider ?? "google";
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

export function createAuthOptions(): NextAuthOptions {
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
    ],
    secret: process.env.AUTH_SECRET,
    session: { strategy: "jwt" },
    callbacks: {
      async jwt({ token, account }) {
        const mailToken = token as MailToken;
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
        if (!mailToken.expiresAt || Date.now() < mailToken.expiresAt - 60_000)
          return mailToken;
        return refreshMailToken(mailToken);
      },
      async session({ session, token }) {
        const mailToken = token as MailToken;
        const provider = mailToken.provider ?? "google";
        const mailSession = session as typeof session & {
          gmail: {
            connected: boolean;
            provider: OAuthMailProvider;
            error?: "RefreshAccessTokenError";
          };
        };
        mailSession.gmail = {
          connected: hasMailScope(provider, mailToken.scope),
          provider,
          error: mailToken.error,
        };
        return mailSession;
      },
    },
  };
}
