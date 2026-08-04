import { MailApp } from "@ssakmail/ui";

export default function Home() {
  return (
    <main>
      <nav>
        <strong>싹메일</strong>
        <span className="site-domain">ssakmail.com</span>
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
        <MailApp variant="web" />
      </div>
    </main>
  );
}
