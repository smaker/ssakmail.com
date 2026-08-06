/// <reference path="./cloudflare-sockets.d.ts" />
import {
  findLabel,
  GmailError,
  getMessage as getGmailMessage,
  getOrCreateLabel,
  listMessagesByLabel,
  type MessageDetail,
  type MessagePage,
  modifyMessageLabels,
  deleteMessage as permanentlyDeleteGmailMessage,
  trashMessage as trashGmailMessage,
} from "@ssakmail/gmail";
import type { ImapConnect, ImapCredentials } from "./imap";
import { ImapError, withImap } from "./imap";
import { imapMailbox } from "./imap-mailbox";
import * as graph from "./microsoft";

export type MailProvider = "google" | "microsoft" | "imap";

export type {
  CleanupCategory,
  MessageDetail,
  MessagePage,
  MessageSummary,
} from "@ssakmail/gmail";
export type { ImapCredentials } from "./imap";
export { ImapError } from "./imap";
export { GmailError as MailError };

export type MailClient = {
  provider: MailProvider;
  listInbox(cursor?: string): Promise<MessagePage>;
  listAutoOrganized(cursor?: string): Promise<MessagePage>;
  getMessage(id: string): Promise<MessageDetail>;
  trashMessage(id: string): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  /** Resolves to false when the provider silently refused the move. */
  moveToAutoOrganized(id: string): Promise<boolean>;
  restoreFromAutoOrganized(id: string): Promise<boolean>;
};

export const providerLabel = (provider: MailProvider) =>
  provider === "google"
    ? "Gmail"
    : provider === "microsoft"
      ? "Outlook"
      : "메일 계정";

export type ImapHostPreset = {
  id: string;
  name: string;
  host: string;
  port: number;
  /** Where the user creates the app password this connection needs. */
  guide: string;
};

export const IMAP_HOST_PRESETS: readonly ImapHostPreset[] = [
  {
    id: "naver",
    name: "네이버 메일",
    host: "imap.naver.com",
    port: 993,
    guide:
      "네이버 메일 > 환경설정 > POP3/IMAP 설정에서 IMAP을 사용함으로 바꾸고 2단계 인증 사용 시 애플리케이션 비밀번호를 발급하세요.",
  },
  {
    id: "daum",
    name: "다음 메일",
    host: "imap.daum.net",
    port: 993,
    guide: "다음 메일 > 환경설정 > IMAP/POP3에서 IMAP을 사용함으로 바꾸세요.",
  },
  {
    id: "kakao",
    name: "카카오 메일",
    host: "imap.kakao.com",
    port: 993,
    guide: "카카오 메일 > 설정 > IMAP/SMTP에서 IMAP을 사용함으로 바꾸세요.",
  },
];

export const findImapPreset = (id: string) =>
  IMAP_HOST_PRESETS.find((preset) => preset.id === id);

export const IMAP_DEFAULT_PORT = 993;

export const isValidImapHost = (host: string) =>
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
    host,
  );

export const isValidImapPort = (port: number) =>
  Number.isInteger(port) && port > 0 && port <= 65535;

function googleClient(accessToken: string): MailClient {
  // The label lookup costs a round trip, so each request reuses one lookup.
  let labelPromise: Promise<string | undefined> | undefined;
  const autoOrganizedLabelId = () => {
    if (!labelPromise)
      labelPromise = getOrCreateLabel(accessToken).then(({ id }) => id);
    return labelPromise;
  };

  return {
    provider: "google",
    listInbox: (cursor) =>
      listMessagesByLabel(accessToken, "INBOX", undefined, cursor),
    listAutoOrganized: async (cursor) => {
      const label = await findLabel(accessToken);
      return label?.id
        ? listMessagesByLabel(accessToken, label.id, undefined, cursor)
        : { messages: [] };
    },
    getMessage: (id) => getGmailMessage(accessToken, id),
    trashMessage: (id) => trashGmailMessage(accessToken, id),
    deleteMessage: (id) => permanentlyDeleteGmailMessage(accessToken, id),
    moveToAutoOrganized: async (id) => {
      const labelId = await autoOrganizedLabelId();
      if (!labelId) return false;
      const labels = await modifyMessageLabels(
        accessToken,
        id,
        [labelId],
        ["INBOX"],
      );
      return labels.includes(labelId) && !labels.includes("INBOX");
    },
    restoreFromAutoOrganized: async (id) => {
      const labelId = await autoOrganizedLabelId();
      if (!labelId) return false;
      const labels = await modifyMessageLabels(
        accessToken,
        id,
        ["INBOX"],
        [labelId],
      );
      return labels.includes("INBOX") && !labels.includes(labelId);
    },
  };
}

function microsoftClient(accessToken: string): MailClient {
  let folderPromise: Promise<string | undefined> | undefined;
  const autoOrganizedFolderId = () => {
    if (!folderPromise)
      folderPromise = graph.getOrCreateFolder(accessToken).then(({ id }) => id);
    return folderPromise;
  };

  return {
    provider: "microsoft",
    listInbox: (cursor) => graph.listInbox(accessToken, undefined, cursor),
    listAutoOrganized: async (cursor) => {
      const folder = await graph.findFolder(accessToken);
      return folder?.id
        ? graph.listFolderMessages(accessToken, folder.id, undefined, cursor)
        : { messages: [] };
    },
    getMessage: (id) => graph.getMessage(accessToken, id),
    trashMessage: (id) => graph.trashMessage(accessToken, id),
    deleteMessage: (id) => graph.deleteMessage(accessToken, id),
    moveToAutoOrganized: async (id) => {
      const folderId = await autoOrganizedFolderId();
      if (!folderId) return false;
      return (await graph.moveMessage(accessToken, id, folderId)) === folderId;
    },
    restoreFromAutoOrganized: async (id) =>
      Boolean(await graph.moveMessage(accessToken, id, "inbox")),
  };
}

function imapClient(
  credentials: ImapCredentials,
  connect: ImapConnect,
): MailClient {
  return { provider: "imap", ...imapMailbox(connect, credentials) };
}

export type MailCredentials =
  | { provider: "google" | "microsoft"; accessToken: string }
  | ({ provider: "imap" } & ImapCredentials);

/**
 * Raw TCP is only available inside the Workers runtime, so the socket factory
 * is loaded lazily and never bundled into a build that cannot use it.
 */
export async function imapConnect(): Promise<ImapConnect> {
  try {
    const sockets = (await import(
      /* webpackIgnore: true */ "cloudflare:sockets"
    )) as { connect: ImapConnect };
    return sockets.connect;
  } catch {
    throw new ImapError(
      502,
      "이 실행 환경에서는 IMAP 연결을 사용할 수 없습니다.",
    );
  }
}

export function mailClient(
  credentials: MailCredentials,
  connect?: ImapConnect,
): MailClient {
  if (credentials.provider === "imap") {
    const { provider: _provider, ...imap } = credentials;
    return imapClient(
      imap,
      connect ??
        ((address, options) => {
          throw new ImapError(
            502,
            `IMAP 소켓이 준비되지 않았습니다 (${address.hostname}:${address.port}${options?.secureTransport ? ", TLS" : ""}).`,
          );
        }),
    );
  }
  return credentials.provider === "microsoft"
    ? microsoftClient(credentials.accessToken)
    : googleClient(credentials.accessToken);
}

/** False outside the Workers runtime, where raw TCP does not exist. */
export async function isImapRuntimeAvailable() {
  try {
    await imapConnect();
    return true;
  } catch {
    return false;
  }
}

/** Throws ImapError(403) when the server rejects the sign-in. */
export async function verifyImapCredentials(credentials: ImapCredentials) {
  await withImap(await imapConnect(), credentials, async () => undefined);
}

/** Resolves the Workers socket factory before building an IMAP client. */
export async function createMailClient(
  credentials: MailCredentials,
): Promise<MailClient> {
  return credentials.provider === "imap"
    ? mailClient(credentials, await imapConnect())
    : mailClient(credentials);
}
