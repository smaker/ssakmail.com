import { describe, expect, it } from "vitest";
import {
  ImapConnection,
  type ImapSocket,
  imapErrorFor,
  isTaggedCompletion,
  parseCompletion,
  quoteAtom,
  quoteMailbox,
  withImap,
} from "./imap";
import {
  decodeMessageId,
  encodeMessageId,
  listMailboxPage,
  pageOfUids,
  parseFetchUnit,
  parseListLine,
} from "./imap-mailbox";

const encoder = new TextEncoder();

/**
 * Answers each tagged command in order, so a test only has to describe the
 * server side of the conversation.
 */
const fakeSocket = (greeting: string, replies: string[]) => {
  const sent: string[] = [];
  let index = 0;
  let closed = false;
  let enqueue: (chunk: string) => void = () => undefined;
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      enqueue = (chunk) => controller.enqueue(encoder.encode(chunk));
      enqueue(greeting);
    },
  });
  const push = (chunk: string) => enqueue(chunk);
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      const command = new TextDecoder().decode(chunk);
      sent.push(command);
      const tag = command.split(" ")[0] ?? "";
      const reply = replies[index] ?? "OK done";
      index += 1;
      push(
        reply.startsWith("*") || reply.includes("\r\n")
          ? `${reply.replace(/\{TAG\}/g, tag)}\r\n`
          : `${tag} ${reply}\r\n`,
      );
    },
  });
  const socket: ImapSocket = {
    readable,
    writable,
    close: async () => {
      closed = true;
    },
  };
  return { socket, sent, isClosed: () => closed };
};

const credentials = {
  host: "imap.example.com",
  port: 993,
  user: "me@example.com",
  password: "app-password",
};

describe("IMAP literals", () => {
  it("escapes quotes and backslashes in atoms", () => {
    expect(quoteAtom('pa"ss\\word')).toBe('"pa\\"ss\\\\word"');
  });

  it("encodes non-ASCII mailbox names as modified UTF-7", () => {
    expect(quoteMailbox("INBOX")).toBe('"INBOX"');
    expect(quoteMailbox("휴지통")).toMatch(/^"&[^"]*-"$/);
  });

  it("recognises only the matching tag as completion", () => {
    expect(isTaggedCompletion("a1 OK done", "a1")).toBe(true);
    expect(isTaggedCompletion("a12 OK done", "a1")).toBe(false);
    expect(isTaggedCompletion("* 1 EXISTS", "a1")).toBe(false);
    expect(parseCompletion("a1 NO bad login")).toEqual({
      ok: false,
      status: "NO",
    });
  });

  it("blames the user only for a rejected login", () => {
    expect(imapErrorFor("LOGIN").status).toBe(403);
    expect(imapErrorFor("SELECT").status).toBe(502);
  });
});

describe("IMAP conversation", () => {
  it("logs in, runs the action and logs out", async () => {
    const { socket, sent, isClosed } = fakeSocket("* OK ready\r\n", [
      "OK logged in",
      "OK selected",
      "OK logged out",
    ]);

    await withImap(
      () => socket,
      credentials,
      async (connection) => connection.select("INBOX"),
    );

    expect(sent[0]).toContain('LOGIN "me@example.com" "app-password"');
    expect(sent[1]).toContain('SELECT "INBOX"');
    expect(sent[2]).toContain("LOGOUT");
    expect(isClosed()).toBe(true);
  });

  it("surfaces a rejected login as a 403 and still closes the socket", async () => {
    const { socket, isClosed } = fakeSocket("* OK ready\r\n", ["NO bad login"]);

    await expect(
      withImap(
        () => socket,
        credentials,
        async () => "unreachable",
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(isClosed()).toBe(true);
  });

  it("reads a literal payload without treating its CRLFs as completion", async () => {
    const payload = "Subject: hi\r\n\r\nbody";
    const { socket } = fakeSocket("* OK ready\r\n", [
      "OK logged in",
      "OK selected",
      `* 1 FETCH (UID 7 BODY[] {${payload.length}}\r\n${payload})\r\n{TAG} OK done`,
      "OK logged out",
    ]);

    const units = await withImap(
      () => socket,
      credentials,
      (connection) => connection.fetch("INBOX", [7], "BODY.PEEK[]"),
    );

    expect(parseFetchUnit(units[0] as string)).toEqual({
      uid: 7,
      payload,
    });
  });

  it("expunges the whole mailbox when UID EXPUNGE is unsupported", async () => {
    const { socket, sent } = fakeSocket("* OK ready\r\n", [
      "OK logged in",
      "OK selected",
      "OK stored",
      "BAD unknown command",
      "OK expunged",
      "OK logged out",
    ]);

    await withImap(
      () => socket,
      credentials,
      (connection) => connection.markDeleted("INBOX", 7),
    );

    expect(sent.some((command) => command.includes("UID EXPUNGE 7"))).toBe(
      true,
    );
    expect(sent.some((command) => /^a\d+ EXPUNGE/.test(command))).toBe(true);
  });
});

describe("IMAP mailbox listing", () => {
  it("parses a LIST line and decodes its mailbox name", () => {
    expect(
      parseListLine('* LIST (\\HasNoChildren \\Trash) "/" "&x4reAOKw-"'),
    ).toMatchObject({ flags: ["\\HasNoChildren", "\\Trash"] });
    expect(parseListLine('* LIST () "/" "INBOX"')?.name).toBe("INBOX");
    expect(parseListLine("* OK not a list")).toBeUndefined();
  });

  it("pages newest first and stops at the end", () => {
    expect(pageOfUids([1, 2, 3, 4, 5], undefined, 2)).toEqual({
      uids: [5, 4],
      nextCursor: "2",
    });
    expect(pageOfUids([1, 2, 3, 4, 5], "2", 2)).toEqual({
      uids: [3, 2],
      nextCursor: "4",
    });
    expect(pageOfUids([1, 2, 3, 4, 5], "4", 2)).toEqual({
      uids: [1],
      nextCursor: undefined,
    });
  });

  it("treats a malformed cursor as the first page", () => {
    expect(pageOfUids([1, 2], "not-a-number", 2).uids).toEqual([2, 1]);
    expect(pageOfUids([1, 2], "-5", 2).uids).toEqual([2, 1]);
  });

  it("round-trips a mailbox and UID through the message id", () => {
    const id = encodeMessageId("싹메일 자동정리함", 42);

    expect(decodeMessageId(id)).toEqual({
      mailbox: "싹메일 자동정리함",
      uid: 42,
    });
  });

  it.each(["", "nope", "bm8.0", "bm8.-1"])(
    "rejects the malformed message id %s",
    (id) => {
      expect(() => decodeMessageId(id)).toThrow();
    },
  );

  it("keeps the newest-first order the server search returned", async () => {
    const header = "Subject: 두번째\r\nFrom: b@example.com\r\n";
    // IMAP literals count bytes, and the Korean subject is multi-byte.
    const headerBytes = encoder.encode(header).length;
    const { socket } = fakeSocket("* OK ready\r\n", [
      "OK logged in",
      "OK selected",
      "* SEARCH 1 2\r\n{TAG} OK done",
      `* 2 FETCH (UID 2 BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {${headerBytes}}\r\n${header})\r\n{TAG} OK done`,
      "OK logged out",
    ]);

    const page = await withImap(
      () => socket,
      credentials,
      (connection) => listMailboxPage(connection, "INBOX", undefined, 1),
    );

    expect(page.messages).toHaveLength(1);
    expect(page.messages[0]).toMatchObject({
      subject: "두번째",
      from: "b@example.com",
    });
    expect(page.nextCursor).toBe("1");
  });
});

describe("IMAP connection reuse", () => {
  it("selects a mailbox only once per connection", async () => {
    const { socket, sent } = fakeSocket("* OK ready\r\n", [
      "OK logged in",
      "OK selected",
      "OK logged out",
    ]);
    const connection = new ImapConnection(socket, credentials);

    await connection.connect();
    await connection.select("INBOX");
    await connection.select("INBOX");

    expect(sent.filter((command) => command.includes("SELECT"))).toHaveLength(
      1,
    );
  });
});
