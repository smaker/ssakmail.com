"use client";

import type { MessageDetail, MessageSummary } from "@ssakmail/gmail";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRef, useState } from "react";

const GMAIL_SCOPE = "https://mail.google.com/";

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
  const removeMessage = (id: string) => {
    queryClient.setQueryData<MessageSummary[]>(
      ["gmail", "messages"],
      (current) => current?.filter((message) => message.id !== id),
    );
    queryClient.removeQueries({ queryKey: ["gmail", "messages", id] });
    setSelectedId(undefined);
  };
  const trash = useMutation({
    mutationFn: (id: string) =>
      axios.post(`/api/gmail/messages/${encodeURIComponent(id)}/trash`),
    onSuccess: (_, id) => removeMessage(id),
  });
  const permanentlyDelete = useMutation({
    mutationFn: (id: string) =>
      axios.delete(`/api/gmail/messages/${encodeURIComponent(id)}/delete`),
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
      <div className="mail-content">
        <div
          className={`message-list ${selectedId ? "message-list--selected" : ""}`}
        >
          <h2>받은편지함</h2>
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
          {messages.data?.map((message) => (
            <button
              className="message-row"
              key={message.id}
              type="button"
              aria-pressed={selectedId === message.id}
              onClick={() => setSelectedId(message.id)}
            >
              <strong>{message.subject}</strong>
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
              <div className="message-actions">
                <button
                  type="button"
                  disabled={trash.isPending || permanentlyDelete.isPending}
                  onClick={() =>
                    window.confirm("이 메일을 휴지통으로 이동할까요?") &&
                    trash.mutate(detail.data.id)
                  }
                >
                  휴지통으로 이동
                </button>
                <button
                  className="button-danger"
                  type="button"
                  disabled={trash.isPending || permanentlyDelete.isPending}
                  onClick={() => deleteDialog.current?.showModal()}
                >
                  영구 삭제
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
        <h2 id="delete-title">메일을 영구 삭제할까요?</h2>
        <p>이 작업은 취소하거나 복구할 수 없습니다.</p>
        <div className="dialog-actions">
          <button type="button" onClick={() => deleteDialog.current?.close()}>
            취소
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
