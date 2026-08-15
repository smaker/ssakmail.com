import { describe, expect, it } from "vitest";
import {
  autoOrganizeSettingsChanged,
  emailHtmlDocument,
  filterMessages,
  flattenMessagePages,
  mailboxEndpoint,
  mailboxPageUrl,
  mailboxQueryKey,
  mailViewState,
  preferenceLabel,
  removeMessageFromPages,
  selectedMessageAfterRemoval,
  shouldRemoveMessageAfterFeedback,
} from "./mail";

describe("mail view state", () => {
  it.each([
    ["loading", false, "loading"],
    ["unauthenticated", false, "signed-out"],
    ["authenticated", false, "needs-gmail"],
    ["authenticated", true, "mailbox"],
  ] as const)("maps %s/%s to %s", (status, connected, expected) => {
    expect(mailViewState(status, connected)).toBe(expected);
  });
});

describe("mailbox routing", () => {
  it.each([
    ["inbox", "/api/gmail/messages", ["gmail", "messages", "inbox"]],
    [
      "auto-organized",
      "/api/gmail/auto-organized",
      ["gmail", "messages", "auto-organized"],
    ],
  ] as const)("routes %s mailbox", (mailbox, endpoint, queryKey) => {
    expect(mailboxEndpoint(mailbox)).toBe(endpoint);
    expect(mailboxQueryKey(mailbox)).toEqual(queryKey);
  });
});

describe("infinite mailbox pages", () => {
  const pages = {
    pageParams: [undefined, "cursor-1"],
    pages: [
      {
        messages: [
          { id: "a", category: "other" },
          { id: "b", category: "other" },
        ],
        nextCursor: "cursor-1",
      },
      { messages: [{ id: "c", category: "other" }] },
    ],
    // biome-ignore lint/suspicious/noExplicitAny: message summaries are trimmed for this unit test
  } as any;

  it("builds a page URL only when a cursor exists", () => {
    expect(mailboxPageUrl("inbox")).toBe("/api/gmail/messages");
    expect(mailboxPageUrl("inbox", "next/page")).toBe(
      "/api/gmail/messages?cursor=next%2Fpage",
    );
  });

  it("flattens every loaded page in order", () => {
    expect(flattenMessagePages(pages).map(({ id }) => id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(flattenMessagePages(undefined)).toEqual([]);
  });

  it("removes a message from whichever page holds it", () => {
    const next = removeMessageFromPages(pages, "b");

    expect(flattenMessagePages(next).map(({ id }) => id)).toEqual(["a", "c"]);
    expect(next?.pages[0]?.nextCursor).toBe("cursor-1");
    expect(removeMessageFromPages(undefined, "b")).toBeUndefined();
  });
});

describe("preference labels", () => {
  it.each([
    [80, "선호 가능성 높음"],
    [50, "확인 필요"],
    [20, "정리 추천"],
  ] as const)("labels score %s", (score, expected) => {
    expect(preferenceLabel(score)).toBe(expected);
  });
});

describe("auto-organize settings", () => {
  const saved = {
    autoOrganizeEnabled: true,
    autoOrganizeConfidenceThreshold: 70,
  };

  it.each([
    [saved, false],
    [{ ...saved, autoOrganizeEnabled: false }, true],
    [{ ...saved, autoOrganizeConfidenceThreshold: 75 }, true],
  ] as const)("detects draft changes", (draft, expected) => {
    expect(autoOrganizeSettingsChanged(saved, draft)).toBe(expected);
  });
});

describe("feedback effects", () => {
  it.each([
    ["preferred", false],
    ["unwanted", true],
    ["trashed", false],
    ["deleted", false],
  ] as const)("removes a message after %s feedback: %s", (action, expected) => {
    expect(shouldRemoveMessageAfterFeedback(action)).toBe(expected);
  });

  it("keeps a different message selected while feedback finishes", () => {
    expect(selectedMessageAfterRemoval("message-b", "message-a")).toBe(
      "message-b",
    );
    expect(
      selectedMessageAfterRemoval("message-a", "message-a"),
    ).toBeUndefined();
  });
});

describe("cleanup filters", () => {
  const messages = [
    { id: "ad", category: "advertisement" },
    { id: "paid", category: "payment" },
    { id: "smishing", category: "smishing" },
    { id: "normal", category: "other" },
  ] as const;

  it.each([
    ["all", ["ad", "paid", "smishing", "normal"]],
    ["cleanup", ["ad", "paid", "smishing"]],
    ["advertisement", ["ad"]],
    ["payment", ["paid"]],
    ["smishing", ["smishing"]],
  ] as const)("shows %s messages", (filter, expected) => {
    expect(filterMessages(messages, filter).map(({ id }) => id)).toEqual(
      expected,
    );
  });
});

describe("safe email HTML document", () => {
  const html =
    '<p>Hello <a href="https://example.com">mail</a><img src="https://example.com/pixel"></p>';

  it("blocks and hides images by default", () => {
    const document = emailHtmlDocument(html, false);

    expect(document).toContain("img-src 'none'");
    expect(document).toContain("img{display:none!important}");
    expect(document).toContain('<a href="https://example.com">mail</a>');
    expect(document).not.toContain('<img src="https://example.com/pixel"');
    expect(document).toContain(
      '<img data-ssakmail-src="https://example.com/pixel"',
    );
  });

  it("removes document controls that can navigate without a click", () => {
    const document = emailHtmlDocument(
      '<meta http-equiv="refresh" content="0;url=https://tracker.example"><base href="https://tracker.example"><a href="https://example.com">mail</a>',
      false,
    );

    expect(document).not.toMatch(/http-equiv="refresh"|<base\b/i);
    expect(document).toContain('<a href="https://example.com">mail</a>');
  });

  it("allows visible HTTPS images only after opt-in", () => {
    const document = emailHtmlDocument(html, true);

    expect(document).toContain("img-src https: data:");
    expect(document).not.toContain("img{display:none}");
    expect(document).toContain('<img src="https://example.com/pixel"');
  });
});
