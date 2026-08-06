import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatSender,
  GRAPH_API,
  getMessage,
  htmlToText,
  isGraphCursor,
  listInbox,
  mapGraphMessage,
  normalizeGraphError,
  toEpochMillis,
} from "./microsoft";

describe("Microsoft Graph message mapping", () => {
  afterEach(() => vi.restoreAllMocks());

  it("formats a sender with and without a display name", () => {
    expect(
      formatSender({ emailAddress: { name: "보낸이", address: "a@b.com" } }),
    ).toBe("보낸이 <a@b.com>");
    expect(formatSender({ emailAddress: { address: "a@b.com" } })).toBe(
      "a@b.com",
    );
    expect(formatSender(undefined)).toBe("알 수 없는 발신자");
  });

  it("converts ISO timestamps to the epoch milliseconds the UI renders", () => {
    expect(toEpochMillis("2026-08-05T01:02:03Z")).toBe(
      String(Date.parse("2026-08-05T01:02:03Z")),
    );
    expect(toEpochMillis(undefined)).toBe("");
    expect(toEpochMillis("not a date")).toBe("");
  });

  it("classifies a mapped message like the Gmail mapper does", () => {
    expect(
      mapGraphMessage({
        id: "m1",
        conversationId: "c1",
        subject: "[광고] 여름 할인",
        from: { emailAddress: { address: "shop@example.com" } },
        receivedDateTime: "2026-08-05T00:00:00Z",
        bodyPreview: "쿠폰을 확인하세요",
      }),
    ).toMatchObject({
      id: "m1",
      threadId: "c1",
      from: "shop@example.com",
      category: "advertisement",
    });
  });

  it("falls back to a title when Graph omits the subject", () => {
    expect(mapGraphMessage({ id: "m1" }).subject).toBe("제목 없음");
  });

  it("strips markup for the plain text body", () => {
    expect(htmlToText("<p>안녕<br> 하세요</p>")).toBe("안녕 하세요");
  });
});

describe("Microsoft Graph pagination", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts only Graph-issued cursors so a crafted cursor cannot redirect the fetch", () => {
    expect(isGraphCursor(`${GRAPH_API}/me/messages?$skip=20`)).toBe(true);
    expect(isGraphCursor("https://attacker.example/steal")).toBe(false);
  });

  it("follows the next link and returns it as the cursor", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        value: [{ id: "m1" }],
        "@odata.nextLink": `${GRAPH_API}/me/mailFolders/inbox/messages?$skip=20`,
      },
    });

    const page = await listInbox(
      "access",
      20,
      `${GRAPH_API}/me/mailFolders/inbox/messages?$skip=20`,
    );

    expect(page.messages).toHaveLength(1);
    expect(page.nextCursor).toContain("$skip=20");
    expect(get.mock.calls[0]?.[0]).toBe(
      `${GRAPH_API}/me/mailFolders/inbox/messages?$skip=20`,
    );
  });

  it("ignores a cursor that does not come from Graph", async () => {
    const get = vi
      .spyOn(axios, "get")
      .mockResolvedValue({ data: { value: [] } });

    await listInbox("access", 20, "https://attacker.example/steal");

    expect(String(get.mock.calls[0]?.[0]).startsWith(`${GRAPH_API}/`)).toBe(
      true,
    );
  });
});

describe("Microsoft Graph message body", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps HTML bodies and derives the plain text fallback", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        id: "m1",
        body: { contentType: "html", content: "<p>본문</p>" },
      },
    });

    await expect(getMessage("access", "m1")).resolves.toMatchObject({
      htmlBody: "<p>본문</p>",
      body: "본문",
    });
  });

  it("leaves text bodies untouched", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { id: "m1", body: { contentType: "text", content: "본문" } },
    });

    await expect(getMessage("access", "m1")).resolves.toMatchObject({
      htmlBody: "",
      body: "본문",
    });
  });
});

describe("Microsoft Graph errors", () => {
  it.each([
    [401, 401],
    [403, 403],
    [404, 404],
    [429, 429],
    [500, 502],
  ])("maps provider status %s to %s", (providerStatus, expected) => {
    expect(
      normalizeGraphError({ response: { status: providerStatus } }),
    ).toMatchObject({ status: expected });
  });

  it("never leaks the provider error message", () => {
    expect(normalizeGraphError(new Error("client_secret leaked")).message).toBe(
      "Outlook 요청을 처리하지 못했습니다.",
    );
  });
});
