import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeBody,
  deleteMessage,
  extractBody,
  mapMessage,
  normalizeGmailError,
  trashMessage,
} from "./index";

describe("Gmail response helpers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps metadata headers into a stable message summary", () => {
    expect(
      mapMessage({
        id: "m1",
        snippet: "preview",
        internalDate: "1720000000000",
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "Subject", value: "Hello" },
          ],
        },
      }),
    ).toMatchObject({
      id: "m1",
      from: "sender@example.com",
      subject: "Hello",
      snippet: "preview",
    });
  });

  it("decodes URL-safe Gmail bodies", () => {
    expect(decodeBody("7JWI64WV")).toBe("안녕");
  });

  it("prefers plain text and safely reduces HTML-only messages to text", () => {
    const plain = btoa("plain");
    const html = btoa("<p>Hello <strong>mail</strong></p>");
    expect(
      extractBody({
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/html", body: { data: html } },
          { mimeType: "text/plain", body: { data: plain } },
        ],
      }),
    ).toBe("plain");
    expect(extractBody({ mimeType: "text/html", body: { data: html } })).toBe(
      "Hello mail",
    );
  });

  it.each([
    [401, 401],
    [403, 403],
    [404, 404],
    [429, 429],
    [500, 502],
  ])("maps Gmail %s to application %s", (providerStatus, expectedStatus) => {
    expect(
      normalizeGmailError({ response: { status: providerStatus } }).status,
    ).toBe(expectedStatus);
  });

  it("keeps recoverable trash and irreversible delete as different Gmail calls", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({});
    const remove = vi.spyOn(axios, "delete").mockResolvedValue({});

    await trashMessage("access", "message/id");
    await deleteMessage("access", "message/id");

    expect(
      String(post.mock.calls[0]?.[0]).endsWith("/messages/message%2Fid/trash"),
    ).toBe(true);
    expect(
      String(remove.mock.calls[0]?.[0]).endsWith("/messages/message%2Fid"),
    ).toBe(true);
  });
});
