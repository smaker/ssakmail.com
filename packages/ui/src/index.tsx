"use client";

import { statusQueryOptions } from "@ssakmail/data-access";
import { useQuery } from "@tanstack/react-query";

export { MailApp, mailViewState } from "./mail";

export const statusPresentation = (
  state: "pending" | "error" | "ready",
  app?: string,
) => ({
  className: `status-dot status-dot--${state}`,
  label:
    state === "pending"
      ? "연결 확인 중"
      : state === "error"
        ? "연결을 확인할 수 없습니다"
        : `${app} 준비 완료`,
});

export function StatusCard() {
  const status = useQuery(statusQueryOptions());
  const presentation = statusPresentation(
    status.isPending ? "pending" : status.isError ? "error" : "ready",
    status.data?.app,
  );

  return (
    <section className="status-card" aria-live="polite">
      <span className={presentation.className} aria-hidden="true" />
      {presentation.label}
    </section>
  );
}
