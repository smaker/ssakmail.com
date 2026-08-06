import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeGoogleToken,
  authorizeMailToken,
  GMAIL_SCOPE,
  GRAPH_MAIL_SCOPE,
  hasGmailScope,
  hasMailScope,
  refreshGoogleToken,
} from "./index";

describe("Google OAuth token helpers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("detects the full Gmail scope", () => {
    expect(hasGmailScope(`openid email ${GMAIL_SCOPE}`)).toBe(true);
    expect(hasGmailScope("openid email profile")).toBe(false);
  });

  it("rejects missing sessions and missing Gmail consent", () => {
    expect(authorizeGoogleToken(null)).toEqual({ status: 401 });
    expect(
      authorizeGoogleToken({ accessToken: "token", scope: "openid email" }),
    ).toEqual({ status: 403 });
    expect(
      authorizeGoogleToken({ accessToken: "token", scope: GMAIL_SCOPE }),
    ).toEqual({ status: 200, accessToken: "token" });
  });

  it("accepts the Microsoft mail scope in either spelling", () => {
    expect(hasMailScope("microsoft", `openid ${GRAPH_MAIL_SCOPE}`)).toBe(true);
    expect(hasMailScope("microsoft", "openid Mail.ReadWrite")).toBe(true);
    expect(hasMailScope("microsoft", "openid Mail.Read")).toBe(false);
    expect(hasMailScope("microsoft", GMAIL_SCOPE)).toBe(false);
  });

  it("authorizes each provider against its own mail scope", () => {
    expect(
      authorizeMailToken({
        provider: "microsoft",
        accessToken: "token",
        scope: `openid ${GRAPH_MAIL_SCOPE}`,
      }),
    ).toEqual({
      status: 200,
      provider: "microsoft",
      credentials: { provider: "microsoft", accessToken: "token" },
    });
    expect(
      authorizeMailToken({
        provider: "microsoft",
        accessToken: "token",
        scope: GMAIL_SCOPE,
      }),
    ).toEqual({ status: 403 });
    expect(
      authorizeMailToken({ accessToken: "token", scope: GMAIL_SCOPE }),
    ).toEqual({
      status: 200,
      provider: "google",
      credentials: { provider: "google", accessToken: "token" },
    });
  });

  it("hands back the stored IMAP credentials instead of a token", () => {
    const imap = {
      host: "imap.naver.com",
      port: 993,
      user: "me@naver.com",
      password: "app-password",
    };

    expect(authorizeMailToken({ provider: "imap", imap })).toEqual({
      status: 200,
      provider: "imap",
      credentials: { provider: "imap", ...imap },
    });
    expect(authorizeMailToken({ provider: "imap" })).toEqual({ status: 401 });
  });

  it("refreshes an expired access token without losing the refresh token", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      data: {
        access_token: "next-access",
        expires_in: 3600,
        scope: GMAIL_SCOPE,
      },
    });

    await expect(
      refreshGoogleToken({
        accessToken: "expired",
        refreshToken: "refresh",
        expiresAt: 0,
        scope: GMAIL_SCOPE,
      }),
    ).resolves.toMatchObject({
      accessToken: "next-access",
      refreshToken: "refresh",
      scope: GMAIL_SCOPE,
    });
  });

  it("marks refresh failures without exposing provider details", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("provider secret"));

    await expect(
      refreshGoogleToken({
        accessToken: "expired",
        refreshToken: "refresh",
        expiresAt: 0,
      }),
    ).resolves.toMatchObject({ error: "RefreshAccessTokenError" });
  });
});
