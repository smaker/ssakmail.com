import { describe, expect, it } from "vitest";
import { mailViewState } from "./mail";

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
