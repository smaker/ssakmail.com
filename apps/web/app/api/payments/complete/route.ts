import { userNamespace } from "@ssakmail/preference";
import { type NextRequest, NextResponse } from "next/server";
import {
  billingSession,
  confirmPayment,
  paymentUnavailable,
  portOneConfig,
} from "../../../../lib/billing";

export async function POST(request: NextRequest) {
  const config = portOneConfig();
  if (!config) return paymentUnavailable();

  const body = (await request.json().catch(() => null)) as {
    paymentId?: unknown;
  } | null;
  if (typeof body?.paymentId !== "string" || body.paymentId.length === 0)
    return NextResponse.json(
      { error: "결제 번호가 올바르지 않습니다." },
      { status: 400 },
    );

  const session = await billingSession(request);
  if (session.response) return session.response;

  const result = await confirmPayment(
    session.env,
    config,
    body.paymentId,
    await userNamespace(session.email),
  );
  return result.ok
    ? NextResponse.json({ status: "PAID" })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
