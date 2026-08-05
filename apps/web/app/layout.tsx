import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import { Theme } from "@astryxdesign/core/theme";
import { ssakmailTheme } from "@ssakmail/ui/theme";
import "@ssakmail/ui/theme.css";
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
        <Theme theme={ssakmailTheme} mode="light">
          <Providers>{children}</Providers>
        </Theme>
      </body>
    </html>
  );
}
