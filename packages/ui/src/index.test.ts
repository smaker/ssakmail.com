import { describe, expect, it } from "vitest";
import { statusPresentation } from "./index";

describe("status presentation", () => {
  it.each([
    ["pending", undefined, "연결 확인 중"],
    ["error", undefined, "연결을 확인할 수 없습니다"],
    ["ready", "웹", "웹 준비 완료"],
  ] as const)("maps %s state to an accessible label", (state, app, label) => {
    expect(statusPresentation(state, app)).toEqual({
      className: `status-dot status-dot--${state}`,
      label,
    });
  });
});
