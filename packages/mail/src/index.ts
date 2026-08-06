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
import * as graph from "./microsoft";

export type MailProvider = "google" | "microsoft";

export type {
  CleanupCategory,
  MessageDetail,
  MessagePage,
  MessageSummary,
} from "@ssakmail/gmail";
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
  provider === "google" ? "Gmail" : "Outlook";

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

export function mailClient(
  provider: MailProvider,
  accessToken: string,
): MailClient {
  return provider === "microsoft"
    ? microsoftClient(accessToken)
    : googleClient(accessToken);
}
