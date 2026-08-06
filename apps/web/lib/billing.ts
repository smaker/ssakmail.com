import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MailToken } from "@ssakmail/auth";
import { checkPayment, type PortOnePayment } from "@ssakmail/billing";
import {
  type BillingEnv,
  getPayment,
  markPaid,
  markUnpaid,
} from "@ssakmail/billing/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const API_BASE = "https://api.portone.io";

export type PortOneConfig = {
  storeId: string;
  channelKey: string;
  apiSecret: string;
};

/** PG사·채널이 정해지기 전에는 결제 요청을 아예 열지 않는다. */
export function portOneConfig(): PortOneConfig | null {
  const storeId = process.env.PORTONE_STORE_ID;
  const channelKey = process.env.PORTONE_CHANNEL_KEY;
  const apiSecret = process.env.PORTONE_API_SECRET;
  return storeId && channelKey && apiSecret
    ? { storeId, channelKey, apiSecret }
    : null;
}

export const paymentUnavailable = () =>
  NextResponse.json(
    { error: "결제 준비 중입니다. 잠시 후 다시 시도해주세요." },
    { status: 503 },
  );

export async function billingSession(request: NextRequest) {
  const token = (await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })) as MailToken | null;
  if (!token?.email)
    return {
      response: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  const { env } = await getCloudflareContext({ async: true });
  return { email: token.email, env: env as unknown as BillingEnv };
}

async function fetchPortOnePayment(paymentId: string, apiSecret: string) {
  const response = await fetch(
    `${API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `PortOne ${apiSecret}` } },
  );
  if (!response.ok) return null;
  return (await response.json()) as PortOnePayment;
}

export type ConfirmResult =
  | { ok: true; newlyPaid: boolean }
  | { ok: false; status: number; error: string };

/**
 * 결제 승인의 단일 경로. 완료 API와 웹훅이 모두 이 함수를 거쳐
 * 포트원 원본 조회 → 저장된 금액 대조 → PENDING일 때만 승인한다.
 */
export async function confirmPayment(
  env: BillingEnv,
  config: PortOneConfig,
  paymentId: string,
  userKey?: string,
): Promise<ConfirmResult> {
  const record = await getPayment(env, paymentId);
  if (!record)
    return { ok: false, status: 404, error: "결제 내역을 찾을 수 없습니다." };
  if (userKey !== undefined && record.user_key !== userKey)
    return { ok: false, status: 403, error: "다른 사용자의 결제입니다." };
  if (record.status === "PAID") return { ok: true, newlyPaid: false };

  const payment = await fetchPortOnePayment(paymentId, config.apiSecret);
  if (!payment)
    return {
      ok: false,
      status: 502,
      error: "결제 정보를 확인하지 못했습니다.",
    };

  const now = new Date();
  const checked = checkPayment(payment, { amount: record.amount });
  if (!checked.ok) {
    if (payment.status === "FAILED" || payment.status === "CANCELLED")
      await markUnpaid(env, paymentId, payment.status, now);
    return {
      ok: false,
      status: 400,
      error:
        checked.reason === "amount"
          ? "결제 금액이 주문 금액과 다릅니다."
          : "결제가 완료되지 않았습니다.",
    };
  }
  return { ok: true, newlyPaid: await markPaid(env, paymentId, now) };
}
