"use client";

import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { VStack } from "@astryxdesign/core/Layout";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Slider } from "@astryxdesign/core/Slider";
import { Switch } from "@astryxdesign/core/Switch";
import type {
  CleanupCategory,
  MailProvider,
  MessageDetail,
  MessagePage,
} from "@ssakmail/mail";
import { providerLabel } from "@ssakmail/mail";
import {
  type FeedbackAction,
  POLICY_VERSION,
  type Recommendation,
} from "@ssakmail/preference";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImapConnectForm } from "./imap-connect";

const GMAIL_SCOPE = "https://mail.google.com/";
const GRAPH_MAIL_SCOPE = "https://graph.microsoft.com/Mail.ReadWrite";
const MICROSOFT_IDENTITY_SCOPE = "openid email profile offline_access";
type Consent = {
  consented: boolean;
  policyVersion: string;
  consentedAt?: string;
  overseasConsentedAt?: string;
  hasData?: boolean;
  autoOrganizeEnabled: boolean;
  autoOrganizeConfidenceThreshold: number;
};
type RecommendationResponse = {
  enabled: boolean;
  recommendation?: Recommendation;
};
type AutoOrganizeSettingsResponse = {
  enabled: boolean;
  confidenceThreshold: number;
};
export type MailProviderAvailability = Record<MailProvider, boolean>;
type MailFilter = "all" | "cleanup" | CleanupCategory;
type Mailbox = "inbox" | "auto-organized";

export const mailboxEndpoint = (mailbox: Mailbox) =>
  mailbox === "inbox" ? "/api/gmail/messages" : "/api/gmail/auto-organized";

export const mailboxQueryKey = (mailbox: Mailbox) => [
  "gmail",
  "messages",
  mailbox,
];

export const mailboxPageUrl = (mailbox: Mailbox, cursor?: string) =>
  cursor
    ? `${mailboxEndpoint(mailbox)}?cursor=${encodeURIComponent(cursor)}`
    : mailboxEndpoint(mailbox);

export const flattenMessagePages = (data?: InfiniteData<MessagePage>) =>
  data?.pages.flatMap((page) => page.messages) ?? [];

export const removeMessageFromPages = (
  data: InfiniteData<MessagePage> | undefined,
  id: string,
) =>
  data && {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.filter((message) => message.id !== id),
    })),
  };

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
      : category === "smishing"
        ? "스미싱 의심"
        : undefined;

export const emailHtmlDocument = (html: string, showImages: boolean) => {
  const content = html
    .replace(/<(?:meta|base)\b[^>]*>/gi, "")
    .replace(/<img\b[^>]*>/gi, (image) =>
      showImages
        ? image
        : image.replace(
            /\s(src|srcset)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
            (attribute) =>
              attribute.replace(/^(\s*)(src|srcset)/i, "$1data-ssakmail-$2"),
          ),
    );
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src ${showImages ? "https: data:" : "'none'"}; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"><style>html{color-scheme:light dark}body{margin:0;overflow-wrap:anywhere}${showImages ? "" : "img{display:none!important}"}</style></head><body>${content}</body></html>`;
};

export const preferenceLabel = (score: number) =>
  score >= 70 ? "선호 가능성 높음" : score >= 40 ? "확인 필요" : "정리 추천";

export const shouldRemoveMessageAfterFeedback = (action: FeedbackAction) =>
  action === "unwanted";

export const selectedMessageAfterRemoval = (
  selectedId: string | undefined,
  removedId: string,
) => (selectedId === removedId ? undefined : selectedId);

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

export const AUTH_PROVIDER_ID: Record<MailProvider, string> = {
  google: "google",
  microsoft: "azure-ad",
  imap: "imap",
};

/** Extra consent parameters that ask the provider for mailbox access. */
export const mailAuthorizationParams = (
  provider: MailProvider,
): Record<string, string> =>
  provider === "google"
    ? {
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
        scope: `openid email profile ${GMAIL_SCOPE}`,
      }
    : {
        prompt: "consent",
        scope: `${MICROSOFT_IDENTITY_SCOPE} ${GRAPH_MAIL_SCOPE}`,
      };

const connectMailbox = (provider: MailProvider) =>
  signIn(
    AUTH_PROVIDER_ID[provider],
    { callbackUrl: "/" },
    mailAuthorizationParams(provider),
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
  const [mailbox, setMailbox] = useState<Mailbox>("inbox");
  const [filter, setFilter] = useState<MailFilter>("all");
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [showImages, setShowImages] = useState(false);
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>();
  const [aiProcessingConsent, setAiProcessingConsent] = useState(false);
  const [overseasTransferConsent, setOverseasTransferConsent] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number }>();
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const mailAccount = (
    session as
      | (typeof session & {
          gmail?: {
            connected: boolean;
            provider?: MailProvider;
            error?: "RefreshAccessTokenError";
          };
        })
      | null
  )?.gmail;
  const provider = mailAccount?.provider ?? "google";
  const mailboxConnected = mailAccount?.connected && !mailAccount.error;
  const state = mailViewState(status, mailboxConnected ?? false);
  const mailProviders = useQuery({
    queryKey: ["mail", "providers"],
    queryFn: async () =>
      (await axios.get<MailProviderAvailability>("/api/mail-providers")).data,
    staleTime: Number.POSITIVE_INFINITY,
  });
  // Treat an unanswered probe as available so the buttons never flash disabled.
  const microsoftAvailable = mailProviders.data?.microsoft !== false;
  const imapAvailable = mailProviders.data?.imap !== false;

  const messages = useInfiniteQuery({
    queryKey: mailboxQueryKey(mailbox),
    queryFn: async ({ pageParam }) =>
      (await axios.get<MessagePage>(mailboxPageUrl(mailbox, pageParam))).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page: MessagePage) => page.nextCursor,
    enabled: state === "mailbox",
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = messages;
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !hasNextPage) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) fetchNextPage();
        },
        { rootMargin: "240px" },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [fetchNextPage, hasNextPage],
  );
  const consent = useQuery({
    queryKey: ["preferences", "consent"],
    queryFn: async () => (await axios.get<Consent>("/api/preferences")).data,
    enabled: state === "mailbox",
  });
  useEffect(() => {
    if (consent.data?.autoOrganizeConfidenceThreshold)
      setConfidenceThreshold(consent.data.autoOrganizeConfidenceThreshold);
  }, [consent.data?.autoOrganizeConfidenceThreshold]);
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
  const updateAutoOrganize = useMutation({
    mutationFn: (settings: { enabled: boolean; confidenceThreshold: number }) =>
      axios.patch<AutoOrganizeSettingsResponse>("/api/preferences", settings),
    onSuccess: ({ data }) => {
      queryClient.setQueryData<Consent>(
        ["preferences", "consent"],
        (current) =>
          current && {
            ...current,
            autoOrganizeEnabled: data.enabled,
            autoOrganizeConfidenceThreshold: data.confidenceThreshold,
          },
      );
      queryClient.invalidateQueries({ queryKey: mailboxQueryKey("inbox") });
    },
  });
  const deleteLearning = useMutation({
    mutationFn: () => axios.delete("/api/preferences"),
    onSuccess: () => {
      queryClient.setQueryData<Consent>(["preferences", "consent"], {
        consented: false,
        hasData: false,
        policyVersion: POLICY_VERSION,
        autoOrganizeEnabled: true,
        autoOrganizeConfidenceThreshold: 70,
      });
      queryClient.removeQueries({
        queryKey: ["preferences", "recommendation"],
      });
    },
  });
  const sendFeedback = (id: string, action: FeedbackAction) =>
    axios.post("/api/preferences/feedback", { messageId: id, action });
  const removeMessage = (id: string, sourceMailbox = mailbox) => {
    queryClient.setQueryData<InfiniteData<MessagePage>>(
      mailboxQueryKey(sourceMailbox),
      (current) => removeMessageFromPages(current, id),
    );
    queryClient.removeQueries({ queryKey: ["gmail", "messages", id] });
    setSelectedId((current) => selectedMessageAfterRemoval(current, id));
  };
  const feedback = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: FeedbackAction;
      sourceMailbox: Mailbox;
    }) => sendFeedback(id, action),
    onSuccess: (_, { id, action, sourceMailbox }) => {
      if (shouldRemoveMessageAfterFeedback(action)) {
        removeMessage(id, sourceMailbox);
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["preferences", "recommendation", selectedId],
      });
    },
  });
  const trash = useMutation({
    mutationFn: async ({ id }: { id: string; sourceMailbox: Mailbox }) => {
      if (consent.data?.consented)
        await sendFeedback(id, "trashed").catch(() => undefined);
      return axios.post(`/api/gmail/messages/${encodeURIComponent(id)}/trash`);
    },
    onSuccess: (_, { id, sourceMailbox }) => {
      deleteDialog.current?.close();
      removeMessage(id, sourceMailbox);
    },
  });
  // Until the user decides, the panel stays open so the consent choice is visible.
  const settingsVisible = settingsOpen ?? consent.data?.consented === false;
  const loadedMessages = flattenMessagePages(messages.data);
  const filteredMessages = filterMessages(loadedMessages, filter);
  const selectMessage = (id?: string) => {
    setShowImages(false);
    setDetailCollapsed(false);
    setSelectedId(id);
  };
  const selectMailbox = (next: Mailbox) => {
    setMailbox(next);
    setFilter("all");
    selectMessage();
  };
  const restore = useMutation({
    mutationFn: (id: string) =>
      axios.post(`/api/gmail/auto-organized/${encodeURIComponent(id)}/restore`),
    onSuccess: (_, id) => {
      removeMessage(id, "auto-organized");
      queryClient.invalidateQueries({ queryKey: mailboxQueryKey("inbox") });
    },
  });
  const permanentlyDelete = useMutation({
    mutationFn: async ({ id }: { id: string; sourceMailbox: Mailbox }) => {
      if (consent.data?.consented)
        await sendFeedback(id, "deleted").catch(() => undefined);
      return axios.delete(
        `/api/gmail/messages/${encodeURIComponent(id)}/delete`,
      );
    },
    onSuccess: (_, { id, sourceMailbox }) => {
      deleteDialog.current?.close();
      removeMessage(id, sourceMailbox);
    },
  });

  // 메뉴가 떠 있는 동안만 바깥 클릭·Esc·스크롤을 듣는다.
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector("button")?.focus();
    const close = () => setMenu(undefined);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  if (state === "loading")
    return (
      <VStack
        className="mail-state"
        gap={2}
        role="status"
        aria-label="로그인 상태 확인 중"
        aria-busy="true"
      >
        <Skeleton width="62%" height={24} />
        <Skeleton width="88%" height={16} index={1} />
        <Skeleton width="44%" height={36} index={2} />
      </VStack>
    );
  if (state === "signed-out") {
    return (
      <section className="mail-state">
        <h2>내 메일함으로 시작하기</h2>
        <p>로그인 후 필요한 시점에만 메일 권한을 요청합니다.</p>
        <div className="provider-actions">
          <Button
            label="Google로 로그인"
            variant="primary"
            onClick={() =>
              signIn(AUTH_PROVIDER_ID.google, { callbackUrl: "/" })
            }
          />
          <Button
            label="Microsoft로 로그인"
            variant="secondary"
            isDisabled={!microsoftAvailable}
            onClick={() =>
              signIn(AUTH_PROVIDER_ID.microsoft, { callbackUrl: "/" })
            }
          />
        </div>
        {!microsoftAvailable && (
          <small className="provider-note">
            Microsoft 계정 로그인은 아직 준비 중입니다. 그동안 Google 계정이나
            아래의 다른 메일 계정으로 이용해주세요.
          </small>
        )}
        <ImapConnectForm available={imapAvailable} />
      </section>
    );
  }
  if (state === "needs-gmail") {
    return (
      <section className="mail-state">
        <h2>{providerLabel(provider)} 연결</h2>
        <p>
          메일 읽기, 휴지통 이동, 영구 삭제를 위해 {providerLabel(provider)}{" "}
          권한이 필요합니다.
        </p>
        <div className="provider-actions">
          <Button
            label={`${providerLabel(provider)} 연결`}
            variant="primary"
            onClick={() => connectMailbox(provider)}
          />
          <Button
            label="로그아웃"
            variant="secondary"
            onClick={() => signOut()}
          />
        </div>
      </section>
    );
  }

  return (
    <section className={`mail-shell mail-shell--${variant}`}>
      <header className="mail-toolbar">
        <div className="mail-account">
          <strong>
            {session?.user?.name ?? `내 ${providerLabel(provider)}`}
          </strong>
          <small>{session?.user?.email}</small>
        </div>
        <div className="mail-toolbar-actions">
          <Button
            label={settingsVisible ? "설정 닫기" : "설정"}
            variant="secondary"
            size="sm"
            aria-expanded={settingsVisible}
            aria-controls="preference-settings"
            onClick={() => setSettingsOpen(!settingsVisible)}
          />
          <Button
            label="로그아웃"
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
          />
        </div>
      </header>
      <section
        id="preference-settings"
        className="preference-settings"
        aria-labelledby="ai-settings-title"
        hidden={!settingsVisible}
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
                width="auto"
                onChange={setAiProcessingConsent}
              />
              <CheckboxInput
                label="국외 이전 동의: Cloudflare, Inc.와 Workers AI 하위처리자 운영 지역(미국·영국 등)에서 암호화된 통신으로 처리하며, 목적과 기간은 AI 분석과 동일합니다."
                value={overseasTransferConsent}
                width="auto"
                onChange={setOverseasTransferConsent}
              />
              <small>
                각 동의를 거부할 수 있으며 Gmail 읽기·수동 삭제에는 불이익이
                없습니다.
              </small>
            </div>
          )}
          {consent.data?.consented && (
            <VStack gap={2} className="auto-organize-settings">
              <Switch
                label="선호도에 따라 싹메일 자동정리함으로 이동"
                value={consent.data.autoOrganizeEnabled}
                width="auto"
                isLoading={updateAutoOrganize.isPending}
                onChange={(enabled) =>
                  updateAutoOrganize.mutate({
                    enabled,
                    confidenceThreshold,
                  })
                }
              />
              <Slider
                label={`자동 정리 최소 신뢰도 ${confidenceThreshold}%`}
                description="선호 가능성 40% 미만인 메일에 적용합니다."
                value={confidenceThreshold}
                min={50}
                max={100}
                step={5}
                width="100%"
                valueDisplay="text"
                formatValue={(value) => `${value}%`}
                isDisabled={
                  !consent.data.autoOrganizeEnabled ||
                  updateAutoOrganize.isPending
                }
                onChange={setConfidenceThreshold}
                onChangeEnd={(value: number) =>
                  updateAutoOrganize.mutate({
                    enabled: consent.data.autoOrganizeEnabled,
                    confidenceThreshold: value,
                  })
                }
              />
              {updateAutoOrganize.isError && (
                <small role="alert">
                  자동 정리 설정을 저장하지 못했습니다.
                </small>
              )}
            </VStack>
          )}
        </div>
        {consent.data?.consented || consent.data?.hasData ? (
          <Button
            label={
              deleteLearning.isPending
                ? "삭제 중"
                : consent.data?.consented
                  ? "동의 철회·데이터 삭제"
                  : "남은 학습 데이터 삭제"
            }
            variant="secondary"
            isLoading={deleteLearning.isPending}
            onClick={() =>
              window.confirm(
                "AI 동의를 철회하고 학습 데이터를 모두 삭제할까요?",
              ) && deleteLearning.mutate()
            }
          />
        ) : (
          <Button
            label={enableAi.isPending ? "동의 처리 중" : "AI 분석에 동의"}
            variant="primary"
            isLoading={enableAi.isPending}
            isDisabled={
              enableAi.isPending ||
              consent.isPending ||
              !aiProcessingConsent ||
              !overseasTransferConsent
            }
            onClick={() => enableAi.mutate()}
          />
        )}
      </section>
      <div
        className={`mail-content ${detailCollapsed ? "mail-content--collapsed" : ""}`}
      >
        <div
          className={`message-list ${selectedId && !detailCollapsed ? "message-list--selected" : ""}`}
        >
          <div className="message-list-header">
            <h2>{mailbox === "inbox" ? "받은편지함" : "싹메일 자동정리함"}</h2>
            <Button
              label={detailCollapsed ? "본문 펼치기" : "본문 접기"}
              variant="ghost"
              size="sm"
              aria-expanded={!detailCollapsed}
              aria-controls="message-detail"
              onClick={() => setDetailCollapsed((collapsed) => !collapsed)}
            />
          </div>
          <fieldset className="message-filters">
            <legend>메일함</legend>
            <Button
              label="받은편지함"
              variant="secondary"
              size="sm"
              aria-pressed={mailbox === "inbox"}
              onClick={() => selectMailbox("inbox")}
            />
            <Button
              label="싹메일 자동정리함"
              variant="secondary"
              size="sm"
              aria-pressed={mailbox === "auto-organized"}
              onClick={() => selectMailbox("auto-organized")}
            />
          </fieldset>
          {mailbox === "inbox" && (
            <fieldset className="message-filters">
              <legend>메일 필터</legend>
              {(
                [
                  ["all", "전체"],
                  ["cleanup", "정리 추천"],
                  ["advertisement", "광고"],
                  ["payment", "결제 완료"],
                  ["smishing", "스미싱 의심"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  label={label}
                  variant="secondary"
                  size="sm"
                  aria-pressed={filter === value}
                  key={value}
                  onClick={() => setFilter(value)}
                />
              ))}
            </fieldset>
          )}
          {messages.isPending && (
            <VStack
              gap={2}
              role="status"
              aria-label="메일을 불러오는 중"
              aria-busy="true"
            >
              {[0, 1, 2, 3].map((index) => (
                <VStack gap={1} key={index}>
                  <Skeleton width="88%" height={18} index={index * 3} />
                  <Skeleton width="68%" height={14} index={index * 3 + 1} />
                  <Skeleton width="42%" height={12} index={index * 3 + 2} />
                </VStack>
              ))}
            </VStack>
          )}
          {messages.isError && (
            <div role="alert">
              <p>메일을 불러오지 못했습니다.</p>
              <Button
                label={`${providerLabel(provider)} 다시 연결`}
                variant="primary"
                onClick={() => connectMailbox(provider)}
              />
            </div>
          )}
          {messages.data && loadedMessages.length === 0 && (
            <p>
              {mailbox === "inbox"
                ? "받은편지함이 비어 있습니다."
                : "자동 정리된 메일이 없습니다."}
            </p>
          )}
          {loadedMessages.length > 0 && filteredMessages.length === 0 && (
            <p>이 조건에 맞는 메일이 없습니다.</p>
          )}
          {filteredMessages.map((message) => (
            <Button
              label={message.subject}
              variant="ghost"
              className="message-row"
              key={message.id}
              aria-pressed={selectedId === message.id}
              onClick={() => selectMessage(message.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                selectMessage(message.id);
                setMenu({
                  id: message.id,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
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
            </Button>
          ))}
          {menu && (
            <div
              className="context-menu"
              ref={menuRef}
              role="menu"
              aria-label="메일 작업"
              // 메뉴 안을 눌렀을 때 바깥 클릭 닫기가 먼저 걸리지 않게 한다
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                left: Math.min(menu.x, window.innerWidth - 200),
                top: Math.min(menu.y, window.innerHeight - 160),
              }}
            >
              {mailbox === "auto-organized" && (
                <button
                  onClick={() => {
                    setMenu(undefined);
                    restore.mutate(menu.id);
                  }}
                  role="menuitem"
                  type="button"
                >
                  받은편지함으로 복원
                </button>
              )}
              <button
                onClick={() => {
                  setMenu(undefined);
                  trash.mutate({ id: menu.id, sourceMailbox: mailbox });
                }}
                role="menuitem"
                type="button"
              >
                휴지통으로 이동
              </button>
              <button
                className="context-menu-danger"
                onClick={() => {
                  setMenu(undefined);
                  if (
                    window.confirm(
                      "이 메일을 영구 삭제할까요? 되돌릴 수 없습니다.",
                    )
                  )
                    permanentlyDelete.mutate({
                      id: menu.id,
                      sourceMailbox: mailbox,
                    });
                }}
                role="menuitem"
                type="button"
              >
                영구 삭제
              </button>
            </div>
          )}
          {hasNextPage && (
            <div className="message-list-sentinel" ref={loadMoreRef}>
              {isFetchingNextPage ? (
                <VStack
                  gap={1}
                  role="status"
                  aria-label="메일을 더 불러오는 중"
                  aria-busy="true"
                >
                  <Skeleton width="88%" height={18} />
                  <Skeleton width="68%" height={14} index={1} />
                </VStack>
              ) : (
                <Button
                  label="더 보기"
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchNextPage()}
                />
              )}
            </div>
          )}
        </div>
        <article
          id="message-detail"
          className={`message-detail ${selectedId ? "message-detail--open" : ""}`}
          hidden={detailCollapsed}
        >
          {variant === "mobile" && selectedId && (
            <Button
              label="목록으로"
              variant="secondary"
              size="sm"
              className="back-button"
              onClick={() => selectMessage()}
            />
          )}
          {!selectedId && (
            <p className="detail-empty">읽을 메일을 선택하세요.</p>
          )}
          {detail.isPending && selectedId && (
            <VStack
              className="message-body"
              gap={3}
              role="status"
              aria-label="메일을 여는 중"
              aria-busy="true"
            >
              <Skeleton width="38%" height={16} />
              <Skeleton width="72%" height={28} index={1} />
              <Skeleton width="100%" height={180} index={2} />
            </VStack>
          )}
          {detail.isError && <p role="alert">메일을 열지 못했습니다.</p>}
          {detail.data && (
            <>
              <p className="message-from">{detail.data.from}</p>
              <h2>{detail.data.subject}</h2>
              <time>{messageDate(detail.data.date)}</time>
              {detail.data.htmlBody ? (
                <section className="message-body">
                  {/<img\b/i.test(detail.data.htmlBody) && (
                    <Button
                      label={showImages ? "이미지 숨기기" : "이미지 보기"}
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowImages((visible) => !visible)}
                    />
                  )}
                  <iframe
                    className="message-html"
                    title="메일 HTML 본문"
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={emailHtmlDocument(detail.data.htmlBody, showImages)}
                  />
                </section>
              ) : (
                <p className="message-body">
                  {detail.data.body || detail.data.snippet}
                </p>
              )}
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
                    <Button
                      label="선호함"
                      variant="secondary"
                      isDisabled={feedback.isPending}
                      onClick={() =>
                        feedback.mutate({
                          id: detail.data.id,
                          action: "preferred",
                          sourceMailbox: mailbox,
                        })
                      }
                    />
                    <Button
                      label="선호하지 않음"
                      variant="secondary"
                      isDisabled={feedback.isPending}
                      onClick={() =>
                        feedback.mutate({
                          id: detail.data.id,
                          action: "unwanted",
                          sourceMailbox: mailbox,
                        })
                      }
                    />
                  </div>
                </section>
              )}
              <div className="message-actions">
                {mailbox === "auto-organized" && (
                  <Button
                    label={
                      restore.isPending ? "복원 중" : "받은편지함으로 복원"
                    }
                    variant="secondary"
                    isLoading={restore.isPending}
                    onClick={() => restore.mutate(detail.data.id)}
                  />
                )}
                <Button
                  label={
                    detail.data.category === "other"
                      ? "삭제 방법 선택"
                      : `${categoryLabel(detail.data.category)} 메일 삭제 검토`
                  }
                  variant="primary"
                  isDisabled={
                    restore.isPending ||
                    trash.isPending ||
                    permanentlyDelete.isPending
                  }
                  onClick={() => deleteDialog.current?.showModal()}
                />
              </div>
              {restore.isError && (
                <p role="alert">
                  메일을 복원하지 못했습니다. 잠시 후 다시 시도해주세요.
                </p>
              )}
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
          <Button
            label="취소"
            variant="secondary"
            onClick={() => deleteDialog.current?.close()}
          />
          <Button
            label={trash.isPending ? "이동 중" : "휴지통으로 이동"}
            variant="secondary"
            isLoading={trash.isPending}
            isDisabled={permanentlyDelete.isPending}
            onClick={() =>
              detail.data &&
              trash.mutate({ id: detail.data.id, sourceMailbox: mailbox })
            }
          />
          <Button
            label={permanentlyDelete.isPending ? "삭제 중" : "영구 삭제"}
            variant="destructive"
            isLoading={permanentlyDelete.isPending}
            onClick={() =>
              detail.data &&
              permanentlyDelete.mutate({
                id: detail.data.id,
                sourceMailbox: mailbox,
              })
            }
          />
        </div>
      </dialog>
    </section>
  );
}
