import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "싹메일 모바일",
  description: "손안에서 간결하게 만나는 싹메일",
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
