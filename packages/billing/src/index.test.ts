import { describe, expect, it } from "vitest";
import { checkPayment, isActive, paidPlan, periodEnd } from "./index";

describe("paidPlan", () => {
  it("유료 요금제를 찾는다", () => {
    expect(paidPlan("plus")?.amount).toBe(4900);
  });
  it("무료·문의 요금제와 잘못된 값은 거절한다", () => {
    expect(paidPlan("free")).toBeNull();
    expect(paidPlan("team")).toBeNull();
    expect(paidPlan(4900)).toBeNull();
    expect(paidPlan(undefined)).toBeNull();
  });
});

describe("checkPayment", () => {
  const paid = { status: "PAID", amount: { total: 4900 }, currency: "KRW" };

  it("상태·금액·통화가 모두 맞아야 통과한다", () => {
    expect(checkPayment(paid, { amount: 4900 })).toEqual({ ok: true });
  });
  it("결제 완료가 아니면 거절한다", () => {
    expect(
      checkPayment({ ...paid, status: "READY" }, { amount: 4900 }),
    ).toEqual({ ok: false, reason: "status" });
  });
  it("금액이 다르면 거절한다", () => {
    expect(
      checkPayment({ ...paid, amount: { total: 100 } }, { amount: 4900 }),
    ).toEqual({ ok: false, reason: "amount" });
  });
  it("금액이 없으면 거절한다", () => {
    expect(checkPayment({ ...paid, amount: null }, { amount: 4900 })).toEqual({
      ok: false,
      reason: "amount",
    });
  });
  it("통화가 다르면 거절한다", () => {
    expect(
      checkPayment({ ...paid, currency: "USD" }, { amount: 4900 }),
    ).toEqual({ ok: false, reason: "currency" });
  });
});

describe("periodEnd", () => {
  it("한 달 뒤로 만료를 잡는다", () => {
    expect(periodEnd(new Date("2026-08-06T00:00:00Z")).toISOString()).toBe(
      "2026-09-06T00:00:00.000Z",
    );
  });
  it("말일은 다음 달 말일로 당긴다", () => {
    expect(periodEnd(new Date("2026-01-31T09:00:00Z")).toISOString()).toBe(
      "2026-02-28T09:00:00.000Z",
    );
  });
  it("연말을 넘긴다", () => {
    expect(periodEnd(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe(
      "2027-01-15T00:00:00.000Z",
    );
  });
});

describe("isActive", () => {
  const now = new Date("2026-08-06T00:00:00Z");
  it("만료 전이면 이용 중이다", () => {
    expect(isActive("2026-09-06T00:00:00.000Z", now)).toBe(true);
  });
  it("만료됐거나 결제 이력이 없으면 아니다", () => {
    expect(isActive("2026-08-05T23:59:59.000Z", now)).toBe(false);
    expect(isActive(null, now)).toBe(false);
  });
});
