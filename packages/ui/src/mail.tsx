"use client";

import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import type {
  CleanupCategory,
  MessageDetail,
  MessageSummary,
} from "@ssakmail/gmail";
import type { FeedbackAction, Recommendation } from "@ssakmail/preference";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRef, useState } from "react";

const GMAIL_SCOPE = "https://mail.google.com/";
type Consent = {
  consented: boolean;
  policyVersion: string;
  consentedAt?: string;
  overseasConsentedAt?: string;
  hasData?: boolean;
};
type RecommendationResponse = {
  enabled: boolean;
  recommendation?: Recommendation;
};
type MailFilter = "all" | "cleanup" | CleanupCategory;

export const filterMessages = <T extends { category: CleanupCategory }>(
  messages: readonly T[],
  filter: MailFilter,
) =>
  filter === "all"
    ? messages
    : messages.filter((message) =>
        filter === "cleanup"
          ? message.category !== "other"
          : message.category === filter,
      );

const categoryLabel = (category: CleanupCategory) =>
  category === "advertisement"
    ? "광고"
    : category === "payment"
      ? "결제 완료"
      : undefined;

export const preferenceLabel = (score: number) =>
  score >= 70 ? "선호 가능성 높음" : score >= 40 ? "확인 필요" : "정리 추천";

export const mailViewState = (
  status: "loading" | "authenticated" | "unauthenticated",
  gmailConnected: boolean,
) =>
  status === "loading"
    ? "loading"
    : status === "unauthenticated"
      ? "signed-out"
      : gmailConnected
        ? "mailbox"
        : "needs-gmail";

const connectGmail = () =>
  signIn(
    "google",
    { callbackUrl: "/" },
    {
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      scope: `openid email profile ${GMAIL_SCOPE}`,
    },
  );

const messageDate = (value: string) =>
  value
    ? new Date(Number(value)).toLocaleString("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

export function MailApp({ variant }: { variant: "web" | "mobile" }) {
  const { data: session, status } = useSession();
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState<MailFilter>("all");
  const [aiProcessingConsent, setAiProcessingConsent] = useState(false);
  const [overseasTransferConsent, setOverseasTransferConsent] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const gmail = (
    session as
      | (typeof session & {
          gmail?: { connected: boolean; error?: "RefreshAccessTokenError" };
        })
      | null
  )?.gmail;
  const gmailConnected = gmail?.connected && !gmail.error;
  const state = mailViewState(status, gmailConnected ?? false);

  const messages = useQuery({
    queryKey: ["gmail", "messages"],
    queryFn: async () =>
      (await axios.get<MessageSummary[]>("/api/gmail/messages")).data,
    enabled: state === "mailbox",
  });
  const consent = useQuery({
    queryKey: ["preferences", "consent"],
    queryFn: async () => (await axios.get<Consent>("/api/preferences")).data,
    enabled: state === "mailbox",
  });
  const detail = useQuery({
    queryKey: ["gmail", "messages", selectedId],
    queryFn: async () =>
      (
        await axios.get<MessageDetail>(
          `/api/gmail/messages/${encodeURIComponent(selectedId ?? "")}`,
        )
      ).data,
    enabled: Boolean(selectedId),
  });
  const recommendation = useQuery({
    queryKey: ["preferences", "recommendation", selectedId],
    queryFn: async () =>
      (
        await axios.post<RecommendationResponse>(
          "/api/preferences/recommendation",
          { messageId: selectedId },
        )
      ).data,
    enabled: Boolean(selectedId && detail.data && consent.data?.consented),
  });
  const enableAi = useMutation({
    mutationFn: () =>
      axios.post<Consent>("/api/preferences", {
        aiProcessing: aiProcessingConsent,
        overseasTransfer: overseasTransferConsent,
      }),
    onSuccess: ({ data }) =>
      queryClient.setQueryData(["preferences", "consent"], data),
  });
  const deleteLearning = useMutation({
    mutationFn: () => axios.delete("/api/preferences"),
    onSuccess: () => {
      queryClient.setQueryData<Consent>(["preferences", "consent"], {
        consented: false,
        hasData: false,
        policyVersion: "2026-08-05",
      });
      queryClient.removeQueries({
        queryKey: ["preferences", "recommendation"],
      });
    },
  });
  const sendFeedback = (id: string, action: FeedbackAction) =>
    axios.post("/api/preferences/feedback", { messageId: id, action });
  const feedback = useMutation({
    mutationFn: ({ id, action }: { id: string; action: FeedbackAction }) =>
      sendFeedback(id, action),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["preferences", "recommendation", selectedId],
      }),
  });
  const removeMessage = (id: string) => {
    queryClient.setQueryData<MessageSummary[]>(
      ["gmail", "messages"],
      (current) => current?.filter((message) => message.id !== id),
    );
    queryClient.removeQueries({ queryKey: ["gmail", "messages", id] });
    setSelectedId(undefined);
  };
  const trash = useMutation({
    mutationFn: async (id: string) => {
      if (consent.data?.consented)
        await sendFeedback(id, "trashed").catch(() => undefined);
      return axios.post(`/api/gmail/messages/${encodeURIComponent(id)}/trash`);
    },
    onSuccess: (_, id) => {
      deleteDialog.current?.close();
      removeMessage(id);
    },
  });
  const filteredMessages = filterMessages(messages.data ?? [], filter);
  const permanentlyDelete = useMutation({
    mutationFn: async (id: string) => {
      if (consent.data?.consented)
        await sendFeedback(id, "deleted").catch(() => undefined);
      return axios.delete(
        `/api/gmail/messages/${encodeURIComponent(id)}/delete`,
      );
    },
    onSuccess: (_, id) => {
      deleteDialog.current?.close();
      removeMessage(id);
    },
  });

  if (state === "loading")
    return <p className="mail-state">로그인 상태 확인 중</p>;
  if (state === "signed-out") {
    return (
      <section className="mail-state">
        <h2>내 Gmail로 시작하기</h2>
        <p>로그인 후 필요한 시점에만 Gmail 권한을 요청합니다.</p>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          Google로 로그인
        </button>
      </section>
    );
  }
  if (state === "needs-gmail") {
    return (
      <section className="mail-state">
        <h2>Gmail 연결</h2>
        <p>메일 읽기, 휴지통 이동, 영구 삭제를 위해 Gmail 권한이 필요합니다.</p>
        <button type="button" onClick={connectGmail}>
          Gmail 연결
        </button>
        <button
          className="button-secondary"
          type="button"
          onClick={() => signOut()}
        >
          로그아웃
        </button>
      </section>
    );
  }

  return (
    <section className={`mail-shell mail-shell--${variant}`}>
      <header className="mail-toolbar">
        <div>
          <strong>{session?.user?.name ?? "내 Gmail"}</strong>
          <small>{session?.user?.email}</small>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={() => signOut()}
        >
          로그아웃
        </button>
      </header>
      <section
        className="preference-settings"
        aria-labelledby="ai-settings-title"
      >
        <div>
          <strong id="ai-settings-title">개인화 AI 추천</strong>
          <small>
            {consent.data?.consented
              ? "마스킹된 메일과 내 선택으로 추천을 학습합니다."
              : "선택 동의 후 개인정보를 마스킹해 추천을 제공합니다."}
          </small>
          {!consent.data?.consented && (
            <div className="consent-summary">
              <CheckboxInput
                label="AI 분석 동의: 개인화 추천을 위해 마스킹된 메일 내용, 분류·임베딩과 사용자 선택을 동의 철회 시까지 처리합니다."
                value={aiProcessingConsent}
                onChange={setAiProcessingConsent}
              />
              <CheckboxInput
                label="국외 이전 동의: Cloudflare, Inc.와 Workers AI 하위처리자 운영 지역(미국·영국 등)에서 암호화된 통신으로 처리하며, 목적과 기간은 AI 분석과 동일합니다."
                value={overseasTransferConsent}
                onChange={setOverseasTransferConsent}
              />
              <small>
                각 동의를 거부할 수 있으며 Gmail 읽기·수동 삭제에는 불이익이
                없습니다.
              </small>
            </div>
          )}
          <a href="/privacy">개인정보처리방침 보기</a>
        </div>
        {consent.data?.consented || consent.data?.hasData ? (
          <button
            className="button-secondary"
            type="button"
            disabled={deleteLearning.isPending}
            onClick={() =>
              window.confirm(
                "AI 동의를 철회하고 학습 데이터를 모두 삭제할까요?",
              ) && deleteLearning.mutate()
            }
          >
            {deleteLearning.isPending
              ? "삭제 중"
              : consent.data?.consented
                ? "동의 철회·데이터 삭제"
                : "남은 학습 데이터 삭제"}
          </button>
        ) : (
          <button
            type="button"
            disabled={
              enableAi.isPending ||
              consent.isPending ||
              !aiProcessingConsent ||
              !overseasTransferConsent
            }
            onClick={() => enableAi.mutate()}
          >
            {enableAi.isPending ? "동의 처리 중" : "AI 분석에 동의"}
          </button>
        )}
      </section>
      <div className="mail-content">
        <div
          className={`message-list ${selectedId ? "message-list--selected" : ""}`}
        >
          <h2>받은편지함</h2>
          <fieldset className="message-filters">
            <legend>메일 필터</legend>
            {(
              [
                ["all", "전체"],
                ["cleanup", "정리 추천"],
                ["advertisement", "광고"],
                ["payment", "결제 완료"],
              ] as const
            ).map(([value, label]) => (
              <button
                className="button-secondary"
                type="button"
                aria-pressed={filter === value}
                key={value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </fieldset>
          {messages.isPending && <p role="status">메일을 불러오는 중</p>}
          {messages.isError && (
            <div role="alert">
              <p>메일을 불러오지 못했습니다.</p>
              <button type="button" onClick={connectGmail}>
                Gmail 다시 연결
              </button>
            </div>
          )}
          {messages.data?.length === 0 && <p>받은편지함이 비어 있습니다.</p>}
          {messages.data && filteredMessages.length === 0 && (
            <p>이 조건에 맞는 메일이 없습니다.</p>
          )}
          {filteredMessages.map((message) => (
            <button
              className="message-row"
              key={message.id}
              type="button"
              aria-pressed={selectedId === message.id}
              onClick={() => setSelectedId(message.id)}
            >
              <strong>{message.subject}</strong>
              {categoryLabel(message.category) && (
                <em
                  className={`candidate-badge candidate-badge--${message.category}`}
                >
                  {categoryLabel(message.category)}
                </em>
              )}
              <span>{message.from}</span>
              <small>{messageDate(message.date)}</small>
            </button>
          ))}
        </div>
        <article
          className={`message-detail ${selectedId ? "message-detail--open" : ""}`}
        >
          {variant === "mobile" && selectedId && (
            <button
              className="button-secondary back-button"
              type="button"
              onClick={() => setSelectedId(undefined)}
            >
              목록으로
            </button>
          )}
          {!selectedId && (
            <p className="detail-empty">읽을 메일을 선택하세요.</p>
          )}
          {detail.isPending && selectedId && (
            <p role="status">메일을 여는 중</p>
          )}
          {detail.isError && <p role="alert">메일을 열지 못했습니다.</p>}
          {detail.data && (
            <>
              <p className="message-from">{detail.data.from}</p>
              <h2>{detail.data.subject}</h2>
              <time>{messageDate(detail.data.date)}</time>
              <p className="message-body">
                {detail.data.body || detail.data.snippet}
              </p>
              {consent.data?.consented && (
                <section className="recommendation-card" aria-live="polite">
                  {recommendation.isPending && <p>개인화 추천 분석 중</p>}
                  {recommendation.data?.recommendation && (
                    <>
                      <strong>
                        {preferenceLabel(
                          recommendation.data.recommendation.preferenceScore,
                        )}{" "}
                        {recommendation.data.recommendation.preferenceScore}%
                      </strong>
                      <p>{recommendation.data.recommendation.reason}</p>
                      <small>
                        신뢰도{" "}
                        {Math.round(
                          recommendation.data.recommendation.confidence * 100,
                        )}
                        % ·{" "}
                        {recommendation.data.recommendation.source === "ai"
                          ? "Workers AI"
                          : "규칙 기반 대체"}
                      </small>
                    </>
                  )}
                  {recommendation.isError && (
                    <p>
                      추천을 불러오지 못했지만 메일 기능은 계속 사용할 수
                      있습니다.
                    </p>
                  )}
                  <div className="feedback-actions">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={feedback.isPending}
                      onClick={() =>
                        feedback.mutate({
                          id: detail.data.id,
                          action: "preferred",
                        })
                      }
                    >
                      선호함
                    </button>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={feedback.isPending}
                      onClick={() =>
                        feedback.mutate({
                          id: detail.data.id,
                          action: "unwanted",
                        })
                      }
                    >
                      선호하지 않음
                    </button>
                  </div>
                </section>
              )}
              <div className="message-actions">
                <button
                  type="button"
                  disabled={trash.isPending || permanentlyDelete.isPending}
                  onClick={() => deleteDialog.current?.showModal()}
                >
                  {detail.data.category === "other"
                    ? "삭제 방법 선택"
                    : `${categoryLabel(detail.data.category)} 메일 삭제 검토`}
                </button>
              </div>
              {(trash.isError || permanentlyDelete.isError) && (
                <p role="alert">
                  메일을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.
                </p>
              )}
            </>
          )}
        </article>
      </div>
      <dialog ref={deleteDialog} aria-labelledby="delete-title">
        <h2 id="delete-title">이 메일을 삭제할까요?</h2>
        <p>{detail.data?.subject}</p>
        <p>휴지통은 복구할 수 있지만 영구 삭제는 취소할 수 없습니다.</p>
        <div className="dialog-actions">
          <button type="button" onClick={() => deleteDialog.current?.close()}>
            취소
          </button>
          <button
            type="button"
            disabled={trash.isPending || permanentlyDelete.isPending}
            onClick={() => detail.data && trash.mutate(detail.data.id)}
          >
            {trash.isPending ? "이동 중" : "휴지통으로 이동"}
          </button>
          <button
            className="button-danger"
            type="button"
            disabled={permanentlyDelete.isPending}
            onClick={() =>
              detail.data && permanentlyDelete.mutate(detail.data.id)
            }
          >
            {permanentlyDelete.isPending ? "삭제 중" : "영구 삭제"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
