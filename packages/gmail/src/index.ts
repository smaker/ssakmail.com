import axios from "axios";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailHeader = { name?: string; value?: string };
export type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  headers?: GmailHeader[];
  parts?: GmailPart[];
};
type GmailMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

export type MessageSummary = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

export type MessageDetail = MessageSummary & { body: string };

export class GmailError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GmailError";
  }
}

const header = (message: GmailMessage, name: string) =>
  message.payload?.headers?.find(
    (item) => item.name?.toLowerCase() === name.toLowerCase(),
  )?.value ?? "";

export const decodeBody = (value?: string) => {
  if (!value) return "";
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(normalized), (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
};

const findPart = (part: GmailPart | undefined, mimeType: string): string => {
  if (!part) return "";
  if (part.mimeType === mimeType && part.body?.data)
    return decodeBody(part.body.data);
  for (const child of part.parts ?? []) {
    const body = findPart(child, mimeType);
    if (body) return body;
  }
  return "";
};

export const extractBody = (part?: GmailPart) => {
  const plainText = findPart(part, "text/plain");
  if (plainText) return plainText;
  const html = findPart(part, "text/html");
  // ponytail: text-only fallback; introduce a sanitizer only if rendered HTML becomes a requirement.
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const mapMessage = (message: GmailMessage): MessageSummary => ({
  id: message.id ?? "",
  threadId: message.threadId ?? "",
  from: header(message, "From") || "알 수 없는 발신자",
  subject: header(message, "Subject") || "제목 없음",
  date: message.internalDate ?? "",
  snippet: message.snippet ?? "",
});

export const normalizeGmailError = (error: unknown) => {
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
      ? "Gmail 요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
      : "Gmail 요청을 처리하지 못했습니다.",
  );
};

const authorization = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export async function listMessages(
  accessToken: string,
  maxResults = 20,
): Promise<MessageSummary[]> {
  try {
    const { data } = await axios.get<{ messages?: Array<{ id: string }> }>(
      `${GMAIL_API}/messages`,
      {
        headers: authorization(accessToken),
        params: { maxResults, labelIds: "INBOX" },
      },
    );
    return Promise.all(
      (data.messages ?? []).map(async ({ id }) => {
        const params = new URLSearchParams({ format: "metadata" });
        for (const name of ["From", "Subject", "Date"])
          params.append("metadataHeaders", name);
        const response = await axios.get<GmailMessage>(
          `${GMAIL_API}/messages/${encodeURIComponent(id)}`,
          {
            headers: authorization(accessToken),
            params,
          },
        );
        return mapMessage(response.data);
      }),
    );
  } catch (error) {
    throw normalizeGmailError(error);
  }
}

export async function getMessage(
  accessToken: string,
  id: string,
): Promise<MessageDetail> {
  try {
    const { data } = await axios.get<GmailMessage>(
      `${GMAIL_API}/messages/${encodeURIComponent(id)}`,
      {
        headers: authorization(accessToken),
        params: { format: "full" },
      },
    );
    return { ...mapMessage(data), body: extractBody(data.payload) };
  } catch (error) {
    throw normalizeGmailError(error);
  }
}

export async function trashMessage(accessToken: string, id: string) {
  try {
    await axios.post(
      `${GMAIL_API}/messages/${encodeURIComponent(id)}/trash`,
      undefined,
      {
        headers: authorization(accessToken),
      },
    );
  } catch (error) {
    throw normalizeGmailError(error);
  }
}

export async function deleteMessage(accessToken: string, id: string) {
  try {
    await axios.delete(`${GMAIL_API}/messages/${encodeURIComponent(id)}`, {
      headers: authorization(accessToken),
    });
  } catch (error) {
    throw normalizeGmailError(error);
  }
}
