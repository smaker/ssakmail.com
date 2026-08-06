import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Webhook } from "@portone/server-sdk";
import type { BillingEnv } from "@ssakmail/billing/cloudflare";
import type { NextRequest } from "next/server";
import { confirmPayment, portOneConfig } from "../../../../lib/billing";

export async function POST(request: NextRequest) {
  const config = portOneConfig();
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!config || !secret)
    return new Response("Not configured", { status: 503 });

  // 서명 검증은 원본 문자열로만 가능하다. JSON.parse 금지.
  const payload = await request.text();
  let webhook: Awaited<ReturnType<typeof Webhook.verify>>;
  try {
    webhook = await Webhook.verify(secret, payload, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    });
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }

  if (!("data" in webhook) || !("paymentId" in webhook.data))
    return new Response("OK");

  const { env } = await getCloudflareContext({ async: true });
  const result = await confirmPayment(
    env as unknown as BillingEnv,
    config,
    webhook.data.paymentId,
  );
  // 검증 실패는 이미 상태로 반영했으므로 재전송을 요구하지 않는다.
  return new Response(result.ok ? "OK" : "Ignored");
}
