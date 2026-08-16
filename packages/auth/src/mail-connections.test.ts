import { describe, expect, it } from "vitest";
import {
  createMailConnectionIntent,
  decryptCredentials,
  encryptCredentials,
  verifyMailConnectionIntent,
} from "./mail-connections";

describe("mail connection credentials", () => {
  it("encrypts and decrypts JSON with AUTH_SECRET", async () => {
    const credentials = {
      provider: "google" as const,
      accessToken: "token",
      scope: "https://mail.google.com/",
      refreshToken: "refresh",
    };
    const encrypted = await encryptCredentials(credentials, "test-secret");
    expect(encrypted).not.toContain("token");
    await expect(decryptCredentials(encrypted, "test-secret")).resolves.toEqual(
      credentials,
    );
    await expect(
      decryptCredentials(encrypted, "wrong-secret"),
    ).rejects.toThrow();
  });

  it("binds encrypted credentials to their connection context", async () => {
    const credentials = {
      provider: "imap" as const,
      host: "imap.example.com",
      port: 993,
      user: "me@example.com",
      password: "app-password",
    };
    const encrypted = await encryptCredentials(
      credentials,
      "test-secret",
      "account:connection:imap",
    );
    await expect(
      decryptCredentials(encrypted, "test-secret", "account:connection:imap"),
    ).resolves.toEqual(credentials);
    await expect(
      decryptCredentials(
        encrypted,
        "test-secret",
        "other-account:connection:imap",
      ),
    ).rejects.toThrow();
  });

  it("expires and scopes OAuth connection intents", async () => {
    const intent = await createMailConnectionIntent(
      "account-1",
      "test-secret",
      "google",
      1_000,
      100,
    );
    await expect(
      verifyMailConnectionIntent(intent, "test-secret", "google", 1_050),
    ).resolves.toMatchObject({ accountKey: "account-1", provider: "google" });
    await expect(
      verifyMailConnectionIntent(intent, "test-secret", "microsoft", 1_050),
    ).resolves.toBeUndefined();
    await expect(
      verifyMailConnectionIntent(intent, "test-secret", "google", 1_101),
    ).resolves.toBeUndefined();
    await expect(
      verifyMailConnectionIntent("not-base64.%%%", "test-secret", "google"),
    ).resolves.toBeUndefined();
  });
});
