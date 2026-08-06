export type PaidPlan = {
  id: string;
  name: string;
  amount: number;
  orderName: string;
};

/** 결제 금액의 유일한 기준. 클라이언트가 보낸 금액은 절대 신뢰하지 않는다. */
export const PAID_PLANS: readonly PaidPlan[] = [
  {
    id: "plus",
    name: "플러스",
    amount: 4900,
    orderName: "싹메일 플러스 1개월",
  },
];

export const CURRENCY = "KRW";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

export const paidPlan = (planId: unknown): PaidPlan | null =>
  typeof planId === "string"
    ? (PAID_PLANS.find((plan) => plan.id === planId) ?? null)
    : null;

/** 포트원 결제내역 단건조회 응답 중 검증에 필요한 부분. */
export type PortOnePayment = {
  status?: unknown;
  amount?: { total?: unknown } | null;
  currency?: unknown;
};

export type PaymentCheck =
  | { ok: true }
  | { ok: false; reason: "status" | "amount" | "currency" };

/** 결제 승인 처리 전에 상태·금액·통화를 모두 대조한다. */
export function checkPayment(
  payment: PortOnePayment,
  expected: { amount: number },
): PaymentCheck {
  if (payment.status !== "PAID") return { ok: false, reason: "status" };
  if (payment.currency !== undefined && payment.currency !== CURRENCY)
    return { ok: false, reason: "currency" };
  if (payment.amount?.total !== expected.amount)
    return { ok: false, reason: "amount" };
  return { ok: true };
}

const lastDayOfMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** 1개월 이용권 만료 시각. 말일은 다음 달 말일로 당겨 클램프한다. */
export function periodEnd(from: Date): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = Math.min(from.getUTCDate(), lastDayOfMonth(year, month + 1));
  const end = new Date(from.getTime());
  end.setUTCFullYear(year, month + 1, day);
  return end;
}

export const isActive = (paidUntil: string | null, now: Date) =>
  paidUntil !== null && Date.parse(paidUntil) > now.getTime();

export const newPaymentId = () => `ssak_${crypto.randomUUID()}`;
