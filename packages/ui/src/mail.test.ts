import { describe, expect, it } from "vitest";
import { filterMessages, mailViewState, preferenceLabel } from "./mail";

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

describe("preference labels", () => {
  it.each([
    [80, "선호 가능성 높음"],
    [50, "확인 필요"],
    [20, "정리 추천"],
  ] as const)("labels score %s", (score, expected) => {
    expect(preferenceLabel(score)).toBe(expected);
  });
});

describe("cleanup filters", () => {
  const messages = [
    { id: "ad", category: "advertisement" },
    { id: "paid", category: "payment" },
    { id: "normal", category: "other" },
  ] as const;

  it.each([
    ["all", ["ad", "paid", "normal"]],
    ["cleanup", ["ad", "paid"]],
    ["advertisement", ["ad"]],
    ["payment", ["paid"]],
  ] as const)("shows %s messages", (filter, expected) => {
    expect(filterMessages(messages, filter).map(({ id }) => id)).toEqual(
      expected,
    );
  });
});
