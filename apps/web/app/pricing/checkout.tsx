"use client";

import { PAID_PLANS } from "@ssakmail/billing";
import { useState } from "react";

type Prepared = {
  paymentId: string;
  storeId: string;
  channelKey: string;
  orderName: string;
  totalAmount: number;
  currency: string;
};

const message = async (response: Response, fallback: string) =>
  ((await response.json().catch(() => null)) as { error?: string } | null)
    ?.error ?? fallback;

export function Checkout() {
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function pay(planId: string) {
    setPendingPlan(planId);
    setStatus(null);
    try {
      const prepare = await fetch("/api/payments/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!prepare.ok) {
        setStatus(await message(prepare, "결제를 시작하지 못했습니다."));
        return;
      }
      const prepared = (await prepare.json()) as Prepared;

      // ponytail: SDK는 결제창을 띄울 때만 필요하므로 이 시점에 불러온다
      const PortOne = await import("@portone/browser-sdk/v2");
      const result = await PortOne.requestPayment({
        storeId: prepared.storeId,
        channelKey: prepared.channelKey,
        paymentId: prepared.paymentId,
        orderName: prepared.orderName,
        totalAmount: prepared.totalAmount,
        currency: prepared.currency as "CURRENCY_KRW",
        payMethod: "CARD",
      });
      if (!result || result.code !== undefined) {
        setStatus(result?.message ?? "결제가 취소되었습니다.");
        return;
      }

      const complete = await fetch("/api/payments/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId: prepared.paymentId }),
      });
      setStatus(
        complete.ok
          ? "결제가 완료됐습니다. 이용권이 바로 적용됩니다."
          : await message(complete, "결제 확인에 실패했습니다."),
      );
    } catch {
      setStatus("결제 중 문제가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <section className="checkout">
      <h2>결제하기</h2>
      <p className="checkout-note">
        로그인한 계정으로 1개월 이용권이 적용됩니다. 결제 수단은 카드입니다.
      </p>
      <div className="checkout-actions">
        {PAID_PLANS.map((plan) => (
          <button
            className="pricing-cta"
            disabled={pendingPlan !== null}
            key={plan.id}
            onClick={() => pay(plan.id)}
            type="button"
          >
            {pendingPlan === plan.id
              ? "결제창을 여는 중…"
              : `${plan.name} ${plan.amount.toLocaleString("ko-KR")}원 결제`}
          </button>
        ))}
      </div>
      {status && (
        <p aria-live="polite" className="checkout-status">
          {status}
        </p>
      )}
    </section>
  );
}
