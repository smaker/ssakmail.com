import {
  AUTO_ORGANIZED_LABEL_NAME,
  classifyMessage,
  GmailError,
  MESSAGE_PAGE_SIZE,
  type MessageDetail,
  type MessagePage,
  type MessageSummary,
} from "@ssakmail/gmail";
import axios from "axios";

export const GRAPH_API = "https://graph.microsoft.com/v1.0";

const SUMMARY_FIELDS =
  "id,conversationId,subject,from,receivedDateTime,bodyPreview";

type GraphRecipient = { emailAddress?: { name?: string; address?: string } };
type GraphMessage = {
  id?: string;
  conversationId?: string;
  subject?: string;
  from?: GraphRecipient;
  receivedDateTime?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
};
type GraphList<T> = { value?: T[]; "@odata.nextLink"?: string };
type GraphFolder = { id?: string; displayName?: string };

export const normalizeGraphError = (error: unknown) => {
  const providerStatus =
    typeof error === "object" && error !== null && "response" in error
      ? (error.response as { status?: number } | undefined)?.status
      : undefined;
  const status =
    providerStatus === 401 ||
    providerStatus === 403 ||
    providerStatus === 404 ||
    providerStatus === 429
      ? providerStatus
      : 502;
  return new GmailError(
    status,
    status === 429
      ? "Outlook 요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
      : "Outlook 요청을 처리하지 못했습니다.",
  );
};

/**
 * Graph hands back an absolute `@odata.nextLink` that we echo to the browser as
 * a cursor, so it has to be re-validated before it is fetched again.
 */
export const isGraphCursor = (cursor: string) =>
  cursor.startsWith(`${GRAPH_API}/`);

export const formatSender = (from?: GraphRecipient) => {
  const { name, address } = from?.emailAddress ?? {};
  if (name && address) return `${name} <${address}>`;
  return address || name || "알 수 없는 발신자";
};

/** Gmail exposes epoch milliseconds; Graph exposes ISO 8601. */
export const toEpochMillis = (receivedDateTime?: string) => {
  const parsed = receivedDateTime ? Date.parse(receivedDateTime) : Number.NaN;
  return Number.isNaN(parsed) ? "" : String(parsed);
};

export const htmlToText = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const mapGraphMessage = (message: GraphMessage): MessageSummary => {
  const summary = {
    id: message.id ?? "",
    threadId: message.conversationId ?? "",
    from: formatSender(message.from),
    subject: message.subject || "제목 없음",
    date: toEpochMillis(message.receivedDateTime),
    snippet: message.bodyPreview ?? "",
  };
  return { ...summary, category: classifyMessage(summary) };
};

const authorization = (accessToken: string) => ({
  adapter: "fetch" as const,
  headers: { Authorization: `Bearer ${accessToken}` },
});

async function listGraphMessages(
  accessToken: string,
  folderPath: string,
  maxResults: number,
  cursor?: string,
): Promise<MessagePage> {
  try {
    const url =
      cursor && isGraphCursor(cursor)
        ? cursor
        : `${GRAPH_API}/me/${folderPath}/messages?$select=${SUMMARY_FIELDS}&$top=${maxResults}&$orderby=receivedDateTime%20desc`;
    const { data } = await axios.get<GraphList<GraphMessage>>(
      url,
      authorization(accessToken),
    );
    return {
      messages: (data.value ?? []).map(mapGraphMessage),
      nextCursor: data["@odata.nextLink"],
    };
  } catch (error) {
    throw normalizeGraphError(error);
  }
}

export const listInbox = (
  accessToken: string,
  maxResults = MESSAGE_PAGE_SIZE,
  cursor?: string,
) => listGraphMessages(accessToken, "mailFolders/inbox", maxResults, cursor);

export async function findFolder(
  accessToken: string,
  name = AUTO_ORGANIZED_LABEL_NAME,
): Promise<GraphFolder | undefined> {
  try {
    const { data } = await axios.get<GraphList<GraphFolder>>(
      `${GRAPH_API}/me/mailFolders?$top=100`,
      authorization(accessToken),
    );
    return data.value?.find((folder) => folder.displayName === name);
  } catch (error) {
    throw normalizeGraphError(error);
  }
}

export async function getOrCreateFolder(
  accessToken: string,
  name = AUTO_ORGANIZED_LABEL_NAME,
): Promise<GraphFolder> {
  const existing = await findFolder(accessToken, name);
  if (existing) return existing;
  try {
    const { data } = await axios.post<GraphFolder>(
      `${GRAPH_API}/me/mailFolders`,
      { displayName: name },
      authorization(accessToken),
    );
    return data;
  } catch (error) {
    const concurrent = await findFolder(accessToken, name);
    if (concurrent) return concurrent;
    throw normalizeGraphError(error);
  }
}

export async function listFolderMessages(
  accessToken: string,
  folderId: string,
  maxResults = MESSAGE_PAGE_SIZE,
  cursor?: string,
) {
  return listGraphMessages(
    accessToken,
    `mailFolders/${encodeURIComponent(folderId)}`,
    maxResults,
    cursor,
  );
}

export async function getMessage(
  accessToken: string,
  id: string,
): Promise<MessageDetail> {
  try {
    const { data } = await axios.get<GraphMessage>(
      `${GRAPH_API}/me/messages/${encodeURIComponent(id)}?$select=${SUMMARY_FIELDS},body`,
      authorization(accessToken),
    );
    const content = data.body?.content ?? "";
    const isHtml = data.body?.contentType?.toLowerCase() === "html";
    return {
      ...mapGraphMessage(data),
      body: isHtml ? htmlToText(content) : content,
      htmlBody: isHtml ? content : "",
    };
  } catch (error) {
    throw normalizeGraphError(error);
  }
}

/** Returns the message's new parent folder id. */
export async function moveMessage(
  accessToken: string,
  id: string,
  destinationId: string,
): Promise<string | undefined> {
  try {
    const { data } = await axios.post<{ parentFolderId?: string }>(
      `${GRAPH_API}/me/messages/${encodeURIComponent(id)}/move`,
      { destinationId },
      authorization(accessToken),
    );
    return data.parentFolderId;
  } catch (error) {
    throw normalizeGraphError(error);
  }
}

export const trashMessage = async (accessToken: string, id: string) => {
  await moveMessage(accessToken, id, "deleteditems");
};

export async function deleteMessage(accessToken: string, id: string) {
  try {
    await axios.delete(
      `${GRAPH_API}/me/messages/${encodeURIComponent(id)}`,
      authorization(accessToken),
    );
  } catch (error) {
    throw normalizeGraphError(error);
  }
}
