import { PricingPlans } from "@ssakmail/ui";
import { Checkout } from "./checkout";

export default function PricingPage() {
  return (
    <main>
      <nav className="gnb">
        <a href="/">싹메일로 돌아가기</a>
      </nav>
      <PricingPlans />
      <Checkout />
    </main>
  );
}
