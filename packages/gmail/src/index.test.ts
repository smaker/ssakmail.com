import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyMessage,
  decodeBody,
  deleteMessage,
  extractBody,
  extractHtmlBody,
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

  it.each([
    [
      {
        subject: "택배 배송지 확인 요청",
        from: "delivery@example.com",
        snippet:
          "주소 오류로 반송 예정입니다. https://short.example/verify 에서 확인",
        labelIds: [],
      },
      "smishing",
    ],
    [
      {
        subject: "스미싱 피해 신고 메일",
        from: "report@example.com",
        snippet: "악성 메시지로 피해가 발생했습니다",
        labelIds: [],
      },
      "smishing",
    ],
    [
      {
        subject: "스미싱 예방 교육 안내",
        from: "security@example.com",
        snippet: "피싱 신고와 대처 방법을 확인하세요",
        labelIds: [],
      },
      "other",
    ],
    [
      {
        subject: "피싱 방지 기능 안내",
        from: "security@example.com",
        snippet: "보안 확인: https://security.example/features",
        labelIds: [],
      },
      "other",
    ],
    [
      {
        subject: "택배 배송 완료",
        from: "delivery@example.com",
        snippet: "정상 배송되었습니다. https://delivery.example/track",
        labelIds: [],
      },
      "other",
    ],
    [
      {
        subject: "(광고) 여름 할인 쿠폰을 확인하세요",
        from: "newsletter@example.com",
        snippet: "수신 거부",
        labelIds: ["CATEGORY_PROMOTIONS"],
      },
      "advertisement",
    ],
    [
      {
        subject: "결제 완료 및 영수증 안내",
        from: "payments@example.com",
        snippet: "결제금액 12,000원 주문번호 A123",
        labelIds: [],
      },
      "payment",
    ],
    [
      {
        subject: "결제 완료 및 본인 인증 안내",
        from: "payments@example.com",
        snippet:
          "영수증과 결제 내역은 https://payments.example/receipt 에서 확인",
        labelIds: [],
      },
      "payment",
    ],
    [
      {
        subject: "결제 실패 안내",
        from: "payments@example.com",
        snippet: "카드를 다시 확인해주세요",
        labelIds: [],
      },
      "other",
    ],
  ] as const)("classifies cleanup candidates as %s", (message, expected) => {
    expect(classifyMessage(message)).toBe(expected);
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

  it("preserves the original HTML for isolated rendering", () => {
    const html = btoa(
      '<p onclick="steal()">Hello <a href="https://example.com">mail</a><img src="https://tracker.example/pixel" onerror="steal()"><script>steal()</script><a href="javascript:steal()">bad</a></p>',
    );

    const result = extractHtmlBody({
      mimeType: "text/html",
      body: { data: html },
    });

    expect(result).toBe(atob(html));
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
