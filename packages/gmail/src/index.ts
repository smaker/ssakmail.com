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
  labelIds?: string[];
  payload?: GmailPart;
};

export type GmailLabel = {
  id?: string;
  name?: string;
  type?: string;
};

export const AUTO_ORGANIZED_LABEL_NAME = "싹메일 자동정리함";

export type CleanupCategory =
  | "advertisement"
  | "payment"
  | "smishing"
  | "other";

export type MessageSummary = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  category: CleanupCategory;
};

export type MessageDetail = MessageSummary & { body: string; htmlBody: string };

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

export const extractHtmlBody = (part?: GmailPart) =>
  findPart(part, "text/html");

export const classifyMessage = (message: {
  subject: string;
  from: string;
  snippet: string;
  labelIds?: readonly string[];
}): CleanupCategory => {
  const text = `${message.subject} ${message.from} ${message.snippet}`;
  const hasLink = /(https?:\/\/|www\.|(?:bit\.ly|tinyurl\.com|t\.co)\/)/i.test(
    text,
  );
  const namesSmishing = /(스미싱|피싱|smishing|phishing)/i.test(text);
  const reportedSmishing =
    namesSmishing &&
    /(피해.{0,8}(발생|신고)|악성.{0,8}(메시지|링크|앱)|사기.{0,8}(피해|발생)|감염)/i.test(
      text,
    );
  const securityAwareness =
    namesSmishing &&
    /(예방|주의|대처|교육|신고|안내|방지|의심|탐지|보호|보안 (?:소식|뉴스))/i.test(
      text,
    );
  if (
    /(결제 실패|결제 거부|승인 실패|payment failed|declined|환불|refund)/i.test(
      text,
    )
  )
    return "other";
  if (
    /(결제 완료|결제 승인|구매 완료|주문 완료|영수증|payment confirmation|payment complete|receipt)/i.test(
      text,
    )
  )
    return "payment";
  if (
    reportedSmishing ||
    (!securityAwareness &&
      hasLink &&
      (namesSmishing ||
        /((택배|배송|배송지).{0,12}(주소.{0,4}(오류|불일치)|반송|실패|중단|재배송|확인 (?:필요|요청))|과태료|범칙금|계정.{0,8}(잠금|정지)|본인.{0,4}인증|보안.{0,4}확인)/i.test(
          text,
        )))
  )
    return "smishing";
  if (
    message.labelIds?.includes("CATEGORY_PROMOTIONS") ||
    /(\(광고\)|\[광고\]|할인|쿠폰|프로모션|이벤트|newsletter|수신 ?거부|unsubscribe)/i.test(
      text,
    )
  )
    return "advertisement";
  return "other";
};

export const mapMessage = (message: GmailMessage): MessageSummary => {
  const summary = {
    id: message.id ?? "",
    threadId: message.threadId ?? "",
    from: header(message, "From") || "알 수 없는 발신자",
    subject: header(message, "Subject") || "제목 없음",
    date: message.internalDate ?? "",
    snippet: message.snippet ?? "",
  };
  return {
    ...summary,
    category: classifyMessage({ ...summary, labelIds: message.labelIds }),
  };
};

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
  return listMessagesByLabel(accessToken, "INBOX", maxResults);
}

export async function listMessagesByLabel(
  accessToken: string,
  labelId: string,
  maxResults = 20,
): Promise<MessageSummary[]> {
  try {
    const { data } = await axios.get<{ messages?: Array<{ id: string }> }>(
      `${GMAIL_API}/messages`,
      {
        headers: authorization(accessToken),
        params: { maxResults, labelIds: labelId },
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

export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  try {
    const { data } = await axios.get<{ labels?: GmailLabel[] }>(
      `${GMAIL_API}/labels`,
      { headers: authorization(accessToken) },
    );
    return data.labels ?? [];
  } catch (error) {
    throw normalizeGmailError(error);
  }
}

export async function findLabel(
  accessToken: string,
  name = AUTO_ORGANIZED_LABEL_NAME,
): Promise<GmailLabel | undefined> {
  return (await listLabels(accessToken)).find((label) => label.name === name);
}

export async function createLabel(
  accessToken: string,
  name = AUTO_ORGANIZED_LABEL_NAME,
): Promise<GmailLabel> {
  try {
    const { data } = await axios.post<GmailLabel>(
      `${GMAIL_API}/labels`,
      { name },
      { headers: authorization(accessToken) },
    );
    return data;
  } catch (error) {
    throw normalizeGmailError(error);
  }
}

export async function getOrCreateLabel(
  accessToken: string,
  name = AUTO_ORGANIZED_LABEL_NAME,
): Promise<GmailLabel> {
  const existing = await findLabel(accessToken, name);
  if (existing) return existing;
  try {
    return await createLabel(accessToken, name);
  } catch (error) {
    const concurrent = await findLabel(accessToken, name);
    if (concurrent) return concurrent;
    throw error;
  }
}

export async function modifyMessageLabels(
  accessToken: string,
  id: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<string[]> {
  try {
    const { data } = await axios.post<GmailMessage>(
      `${GMAIL_API}/messages/${encodeURIComponent(id)}/modify`,
      { addLabelIds, removeLabelIds },
      { headers: authorization(accessToken) },
    );
    return data.labelIds ?? [];
  } catch (error) {
    throw normalizeGmailError(error);
  }
}

export const moveToAutoOrganizedLabel = (
  accessToken: string,
  id: string,
  labelId: string,
) => modifyMessageLabels(accessToken, id, [labelId], ["INBOX"]);

export const restoreFromAutoOrganizedLabel = (
  accessToken: string,
  id: string,
  labelId: string,
) => modifyMessageLabels(accessToken, id, ["INBOX"], [labelId]);

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
    return {
      ...mapMessage(data),
      body: extractBody(data.payload),
      htmlBody: extractHtmlBody(data.payload),
    };
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
