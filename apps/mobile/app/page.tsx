import { MailApp } from "@ssakmail/ui";

export default function Home() {
  return (
    <main>
      <header className="gnb">
        <div>
          <a href="/pricing">요금제</a>
          <strong>싹메일</strong>
        </div>
        <span>mobile</span>
      </header>
      <section className="phone-card">
        <p className="eyebrow">SSAKMAIL MOBILE</p>
        <h1>
          중요한 소식만
          <br />
          가볍게.
        </h1>
        <p className="intro">
          작은 화면에서도 읽기 쉽고 빠른 메일 경험을 준비하고 있습니다.
        </p>
        <MailApp variant="mobile" />
      </section>
    </main>
  );
}
