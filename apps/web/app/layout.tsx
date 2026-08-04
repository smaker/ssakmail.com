import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "싹메일 | ssakmail.com",
  description: "필요한 소식을 깔끔하게 전하는 싹메일",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
