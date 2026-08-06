import { userNamespace } from "@ssakmail/preference";
import {
  isActive,
  newPaymentId,
  type PaidPlan,
  type PaymentStatus,
  periodEnd,
} from "./index";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<{ meta?: { changes?: number } }>;
};

export type BillingEnv = {
  PREFERENCES_DB: { prepare: (sql: string) => Statement };
};

export type PaymentRecord = {
  payment_id: string;
  user_key: string;
  plan_id: string;
  amount: number;
  status: PaymentStatus;
  paid_until: string | null;
};

/** 결제를 PENDING으로 먼저 적어 두고, 승인은 서버 검증 후에만 한다. */
export async function createPendingPayment(
  env: BillingEnv,
  email: string,
  plan: PaidPlan,
  now: Date,
) {
  const paymentId = newPaymentId();
  const timestamp = now.toISOString();
  await env.PREFERENCES_DB.prepare(
    `INSERT INTO payments (payment_id, user_key, plan_id, amount, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
  )
    .bind(
      paymentId,
      await userNamespace(email),
      plan.id,
      plan.amount,
      timestamp,
      timestamp,
    )
    .run();
  return paymentId;
}

export const getPayment = (env: BillingEnv, paymentId: string) =>
  env.PREFERENCES_DB.prepare(
    `SELECT payment_id, user_key, plan_id, amount, status, paid_until
     FROM payments WHERE payment_id = ?`,
  )
    .bind(paymentId)
    .first<PaymentRecord>();

/**
 * PENDING인 결제만 PAID로 넘긴다. 완료 API와 웹훅이 동시에 들어와도
 * 한 번만 반영되도록 status 조건을 UPDATE에 넣는다.
 */
export async function markPaid(
  env: BillingEnv,
  paymentId: string,
  now: Date,
): Promise<boolean> {
  const result = await env.PREFERENCES_DB.prepare(
    `UPDATE payments SET status = 'PAID', paid_until = ?, updated_at = ?
     WHERE payment_id = ? AND status = 'PENDING'`,
  )
    .bind(periodEnd(now).toISOString(), now.toISOString(), paymentId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function markUnpaid(
  env: BillingEnv,
  paymentId: string,
  status: Extract<PaymentStatus, "FAILED" | "CANCELLED">,
  now: Date,
) {
  await env.PREFERENCES_DB.prepare(
    `UPDATE payments SET status = ?, updated_at = ?
     WHERE payment_id = ? AND status != 'PAID'`,
  )
    .bind(status, now.toISOString(), paymentId)
    .run();
}

/** 가장 늦게 끝나는 결제 건으로 현재 구독 상태를 판단한다. */
export async function getSubscription(
  env: BillingEnv,
  email: string,
  now: Date,
) {
  const row = await env.PREFERENCES_DB.prepare(
    `SELECT plan_id, paid_until FROM payments
     WHERE user_key = ? AND status = 'PAID'
     ORDER BY paid_until DESC LIMIT 1`,
  )
    .bind(await userNamespace(email))
    .first<{ plan_id: string; paid_until: string | null }>();
  const active = isActive(row?.paid_until ?? null, now);
  return {
    planId: active ? (row?.plan_id ?? "free") : "free",
    paidUntil: active ? row?.paid_until : null,
    active,
  };
}
