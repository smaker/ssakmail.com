export type PricingPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  summary: string;
  features: readonly string[];
  cta: string;
  featured?: boolean;
};

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: "free",
    name: "무료",
    price: "0원",
    period: "월",
    summary: "메일 한 개 계정을 연결해 정리 기능을 그대로 사용합니다.",
    features: [
      "메일 계정 1개 연결",
      "광고·결제·스미싱 자동 분류",
      "휴지통 이동과 영구 삭제",
      "선택 동의 시 개인화 AI 추천",
    ],
    cta: "지금 시작하기",
  },
  {
    id: "plus",
    name: "플러스",
    price: "4,900원",
    period: "월",
    summary: "여러 계정을 한 화면에서 정리하고 자동 정리를 더 자주 돌립니다.",
    features: [
      "메일 계정 5개 연결",
      "무료 요금제의 모든 기능",
      "자동 정리 신뢰도 세부 조정",
      "우선 응답 고객 지원",
    ],
    cta: "플러스 시작하기",
    featured: true,
  },
  {
    id: "team",
    name: "팀",
    price: "문의",
    period: "구성원",
    summary: "구성원 계정을 함께 관리하고 정리 정책을 공유합니다.",
    features: [
      "계정 수 제한 없음",
      "플러스 요금제의 모든 기능",
      "팀 공통 정리 정책",
      "도입·이관 지원",
    ],
    cta: "도입 문의",
  },
];

export function PricingPlans() {
  return (
    <article className="pricing">
      <p className="eyebrow">PRICING</p>
      <h1>요금제</h1>
      <p className="intro">
        메일을 정리하는 핵심 기능은 무료입니다. 계정을 여러 개 쓰거나 팀과 함께
        쓸 때만 유료 요금제를 선택하세요.
      </p>
      <ul className="pricing-grid">
        {PRICING_PLANS.map((plan) => (
          <li
            className={`pricing-card ${plan.featured ? "pricing-card--featured" : ""}`}
            key={plan.id}
          >
            {plan.featured && <em className="pricing-tag">가장 많이 선택</em>}
            <h2>{plan.name}</h2>
            <p className="pricing-price">
              <strong>{plan.price}</strong>
              <small>/{plan.period}</small>
            </p>
            <p className="pricing-summary">{plan.summary}</p>
            <ul className="pricing-features">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <a className="pricing-cta" href="/">
              {plan.cta}
            </a>
          </li>
        ))}
      </ul>
      <p className="pricing-note">
        표시 금액은 부가세 포함이며 결제 수단과 청구 주기는 결제 도입 후
        안내합니다. 유료 요금제는 준비 중이라 현재는 무료 요금제만 이용할 수
        있습니다.
      </p>
    </article>
  );
}
