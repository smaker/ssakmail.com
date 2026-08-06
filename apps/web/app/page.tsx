import { MailApp } from "@ssakmail/ui";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main>
      <nav>
        <strong>싹메일</strong>
        <div>
          <a href="/pricing">요금제</a>
          <span className="site-domain">ssakmail.com</span>
        </div>
      </nav>
      <div className="hero">
        <p className="eyebrow">SIMPLE MAIL, CLEAR MESSAGE</p>
        <h1>
          전할 말만 남기고
          <br />싹 정리했습니다.
        </h1>
        <p className="intro">
          웹과 모바일에서 같은 경험으로 시작하는 싹메일입니다.
        </p>
      </div>
      <MailApp variant="web" />
    </main>
  );
}
