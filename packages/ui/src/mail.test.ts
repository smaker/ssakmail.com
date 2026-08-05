import { describe, expect, it } from "vitest";
import { filterMessages, mailViewState } from "./mail";

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
