import { CURRENCY, paidPlan } from "@ssakmail/billing";
import { createPendingPayment } from "@ssakmail/billing/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import {
  billingSession,
  paymentUnavailable,
  portOneConfig,
} from "../../../../lib/billing";

export async function POST(request: NextRequest) {
  const config = portOneConfig();
  if (!config) return paymentUnavailable();

  const body = (await request.json().catch(() => null)) as {
    planId?: unknown;
  } | null;
  const plan = paidPlan(body?.planId);
  if (!plan)
    return NextResponse.json(
      { error: "결제할 수 있는 요금제가 아닙니다." },
      { status: 400 },
    );

  const session = await billingSession(request);
  if (session.response) return session.response;

  const paymentId = await createPendingPayment(
    session.env,
    session.email,
    plan,
    new Date(),
  );
  return NextResponse.json({
    paymentId,
    storeId: config.storeId,
    channelKey: config.channelKey,
    orderName: plan.orderName,
    totalAmount: plan.amount,
    currency: CURRENCY,
  });
}
