import axios from "axios";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";

export const GMAIL_SCOPE = "https://mail.google.com/";
export const IDENTITY_SCOPE = "openid email profile";

export type GoogleToken = JWT & {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  error?: "RefreshAccessTokenError";
};

export const hasGmailScope = (scope?: string) =>
  scope?.split(" ").includes(GMAIL_SCOPE) ?? false;

export const authorizeGoogleToken = (token: GoogleToken | null) => {
  if (!token?.accessToken || token.error) return { status: 401 as const };
  if (!hasGmailScope(token.scope)) return { status: 403 as const };
  return { status: 200 as const, accessToken: token.accessToken };
};

export async function refreshGoogleToken(
  token: GoogleToken,
): Promise<GoogleToken> {
  try {
    if (!token.refreshToken) throw new Error("Missing refresh token");

    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });
    const { data } = await axios.post<{
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      scope?: string;
    }>("https://oauth2.googleapis.com/token", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return {
      ...token,
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

export function createAuthOptions(): NextAuthOptions {
  return {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        authorization: { params: { scope: IDENTITY_SCOPE } },
      }),
    ],
    secret: process.env.AUTH_SECRET,
    session: { strategy: "jwt" },
    callbacks: {
      async jwt({ token, account }) {
        const googleToken = token as GoogleToken;
        if (account) {
          return {
            ...googleToken,
            accessToken: account.access_token,
            refreshToken: account.refresh_token ?? googleToken.refreshToken,
            expiresAt: account.expires_at
              ? account.expires_at * 1000
              : undefined,
            scope: account.scope,
            error: undefined,
          };
        }
        if (
          !googleToken.expiresAt ||
          Date.now() < googleToken.expiresAt - 60_000
        )
          return googleToken;
        return refreshGoogleToken(googleToken);
      },
      async session({ session, token }) {
        const googleToken = token as GoogleToken;
        const gmailSession = session as typeof session & {
          gmail: { connected: boolean; error?: "RefreshAccessTokenError" };
        };
        gmailSession.gmail = {
          connected: hasGmailScope(googleToken.scope),
          error: googleToken.error,
        };
        return gmailSession;
      },
    },
  };
}
