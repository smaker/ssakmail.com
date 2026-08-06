import {
  AUTO_ORGANIZED_LABEL_NAME,
  classifyMessage,
  MESSAGE_PAGE_SIZE,
  type MessageDetail,
  type MessagePage,
  type MessageSummary,
} from "@ssakmail/gmail";
import {
  type ImapConnect,
  type ImapConnection,
  type ImapCredentials,
  ImapError,
  withImap,
} from "./imap";
import { decodeModifiedUtf7, parseMessage } from "./mime";

export const INBOX = "INBOX";

/**
 * A UID only identifies a message inside one mailbox, and a move changes it,
 * so the id handed to the browser carries the mailbox it was read from.
 */
export const encodeMessageId = (mailbox: string, uid: number) =>
  `${btoa(unescape(encodeURIComponent(mailbox)))}.${uid}`;

export const decodeMessageId = (id: string) => {
  const separator = id.lastIndexOf(".");
  const uid = Number(id.slice(separator + 1));
  if (separator <= 0 || !Number.isInteger(uid) || uid <= 0)
    throw new ImapError(404, "메일을 찾지 못했습니다.");
  try {
    return {
      mailbox: decodeURIComponent(escape(atob(id.slice(0, separator)))),
      uid,
    };
  } catch {
    throw new ImapError(404, "메일을 찾지 못했습니다.");
  }
};

/** `* LIST (\HasNoChildren \Trash) "/" "INBOX.Trash"` */
export const parseListLine = (line: string) => {
  const parsed = /^\* LIST \(([^)]*)\)\s+(?:"[^"]*"|NIL)\s+(.*)$/i.exec(line);
  if (!parsed) return undefined;
  const rawName = (parsed[2] ?? "").trim();
  const name = rawName.startsWith('"')
    ? rawName.slice(1, rawName.lastIndexOf('"')).replace(/\\(["\\])/g, "$1")
    : rawName;
  return {
    flags: (parsed[1] ?? "").split(/\s+/).filter(Boolean),
    name: decodeModifiedUtf7(name),
    rawName: name,
  };
};

export const parseFetchUnit = (unit: string) => {
  const uid = Number(/\bUID (\d+)/i.exec(unit)?.[1]);
  const literal = /\{(\d+)\}\r\n/.exec(unit);
  if (!Number.isInteger(uid) || !literal) return undefined;
  const start = (literal.index ?? 0) + literal[0].length;
  return { uid, payload: unit.slice(start, start + Number(literal[1])) };
};

/** Newest first, with the cursor counting messages already delivered. */
export const pageOfUids = (
  ascendingUids: readonly number[],
  cursor: string | undefined,
  pageSize: number,
) => {
  const offset = Number(cursor ?? 0);
  const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
  const descending = [...ascendingUids].sort((left, right) => right - left);
  const uids = descending.slice(start, start + pageSize);
  return {
    uids,
    nextCursor:
      start + uids.length < descending.length
        ? String(start + uids.length)
        : undefined,
  };
};

const TRASH_NAMES = ["Trash", "Deleted Items", "지운편지함", "휴지통"];

async function findMailbox(
  connection: ImapConnection,
  matches: (entry: { flags: string[]; name: string }) => boolean,
) {
  for (const line of await connection.listMailboxes()) {
    const entry = parseListLine(line);
    if (entry && matches(entry)) return entry.name;
  }
  return undefined;
}

export const findTrashMailbox = (connection: ImapConnection) =>
  findMailbox(
    connection,
    (entry) =>
      entry.flags.some((flag) => flag.toLowerCase() === "\\trash") ||
      TRASH_NAMES.includes(entry.name),
  );

export const findAutoOrganizedMailbox = (
  connection: ImapConnection,
  name = AUTO_ORGANIZED_LABEL_NAME,
) => findMailbox(connection, (entry) => entry.name === name);

const summaryOf = (mailbox: string, uid: number, raw: string) => {
  const parsed = parseMessage(raw);
  const summary = {
    id: encodeMessageId(mailbox, uid),
    threadId: "",
    from: parsed.from,
    subject: parsed.subject,
    date: parsed.date,
    // IMAP has no cheap preview, so classification runs on the headers alone.
    snippet: "",
  };
  return {
    summary: { ...summary, category: classifyMessage(summary) },
    parsed,
  };
};

export async function listMailboxPage(
  connection: ImapConnection,
  mailbox: string,
  cursor?: string,
  pageSize = MESSAGE_PAGE_SIZE,
): Promise<MessagePage> {
  const { uids, nextCursor } = pageOfUids(
    await connection.searchAll(mailbox),
    cursor,
    pageSize,
  );
  const units = await connection.fetch(
    mailbox,
    uids,
    "BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)]",
  );
  const byUid = new Map<number, MessageSummary>();
  for (const unit of units) {
    const fetched = parseFetchUnit(unit);
    if (fetched)
      byUid.set(
        fetched.uid,
        summaryOf(mailbox, fetched.uid, fetched.payload).summary,
      );
  }
  return {
    messages: uids
      .map((uid) => byUid.get(uid))
      .filter((message): message is MessageSummary => Boolean(message)),
    nextCursor,
  };
}

export async function readMessage(
  connection: ImapConnection,
  mailbox: string,
  uid: number,
): Promise<MessageDetail> {
  const [unit] = await connection.fetch(mailbox, [uid], "BODY.PEEK[]");
  const fetched = unit ? parseFetchUnit(unit) : undefined;
  if (!fetched) throw new ImapError(404, "메일을 찾지 못했습니다.");
  const { summary, parsed } = summaryOf(mailbox, uid, fetched.payload);
  return {
    ...summary,
    snippet: parsed.text.slice(0, 200),
    body: parsed.text,
    htmlBody: parsed.html,
  };
}

export type ImapMailbox = {
  listInbox(cursor?: string): Promise<MessagePage>;
  listAutoOrganized(cursor?: string): Promise<MessagePage>;
  getMessage(id: string): Promise<MessageDetail>;
  trashMessage(id: string): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  moveToAutoOrganized(id: string): Promise<boolean>;
  restoreFromAutoOrganized(id: string): Promise<boolean>;
};

export function imapMailbox(
  connect: ImapConnect,
  credentials: ImapCredentials,
): ImapMailbox {
  const run = <T>(action: (connection: ImapConnection) => Promise<T>) =>
    withImap(connect, credentials, action);

  return {
    listInbox: (cursor) =>
      run((connection) => listMailboxPage(connection, INBOX, cursor)),
    listAutoOrganized: (cursor) =>
      run(async (connection) => {
        const mailbox = await findAutoOrganizedMailbox(connection);
        return mailbox
          ? listMailboxPage(connection, mailbox, cursor)
          : { messages: [] };
      }),
    getMessage: (id) => {
      const { mailbox, uid } = decodeMessageId(id);
      return run((connection) => readMessage(connection, mailbox, uid));
    },
    trashMessage: async (id) => {
      const { mailbox, uid } = decodeMessageId(id);
      await run(async (connection) => {
        const trash = await findTrashMailbox(connection);
        if (!trash) throw new ImapError(404, "휴지통을 찾지 못했습니다.");
        if (!(await connection.move(mailbox, uid, trash)))
          throw new ImapError(502, "메일을 휴지통으로 옮기지 못했습니다.");
      });
    },
    deleteMessage: async (id) => {
      const { mailbox, uid } = decodeMessageId(id);
      await run((connection) => connection.markDeleted(mailbox, uid));
    },
    moveToAutoOrganized: (id) => {
      const { mailbox, uid } = decodeMessageId(id);
      return run(async (connection) => {
        let destination = await findAutoOrganizedMailbox(connection);
        if (!destination) {
          await connection.createMailbox(AUTO_ORGANIZED_LABEL_NAME);
          destination = await findAutoOrganizedMailbox(connection);
        }
        return destination ? connection.move(mailbox, uid, destination) : false;
      });
    },
    restoreFromAutoOrganized: (id) => {
      const { mailbox, uid } = decodeMessageId(id);
      return run((connection) => connection.move(mailbox, uid, INBOX));
    },
  };
}
