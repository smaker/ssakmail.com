import { GmailError } from "@ssakmail/gmail";
import { bytesToBinary, encodeModifiedUtf7 } from "./mime";

/**
 * Just enough IMAP4rev1 to list, read, move and delete mail.
 *
 * The socket is injected so the protocol logic stays testable outside the
 * Workers runtime, where the real implementation comes from `cloudflare:sockets`.
 */
export type ImapSocket = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
};

export type ImapConnect = (
  address: { hostname: string; port: number },
  options?: { secureTransport?: "on" },
) => ImapSocket;

export type ImapCredentials = {
  host: string;
  port: number;
  user: string;
  password: string;
};

export type ImapResponse = { lines: string[]; ok: boolean; status: string };

/** Extends the shared mail error so route handlers map its status verbatim. */
export class ImapError extends GmailError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = "ImapError";
  }
}

/** A LOGIN failure is the user's problem to fix; everything else is ours. */
export const imapErrorFor = (command: string) =>
  command === "LOGIN"
    ? new ImapError(
        403,
        "메일 계정 로그인에 실패했습니다. 주소와 앱 비밀번호를 확인해주세요.",
      )
    : new ImapError(502, "메일 서버 요청을 처리하지 못했습니다.");

export const quoteAtom = (value: string) =>
  `"${value.replace(/([\\"])/g, "\\$1")}"`;

export const quoteMailbox = (name: string) =>
  quoteAtom(encodeModifiedUtf7(name));

/**
 * A tagged completion line ends the response; `{123}` literals may carry
 * embedded CRLFs, so completion is only checked at the start of a line.
 */
export const isTaggedCompletion = (line: string, tag: string) =>
  new RegExp(`^${tag} (OK|NO|BAD)\\b`, "i").test(line);

export const parseCompletion = (line: string) => {
  const status = /^\S+ (OK|NO|BAD)\b/i.exec(line)?.[1]?.toUpperCase() ?? "BAD";
  return { ok: status === "OK", status };
};

export class ImapConnection {
  private tagCounter = 0;
  private buffer = "";
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private selected?: string;

  constructor(
    private readonly socket: ImapSocket,
    private readonly credentials: ImapCredentials,
  ) {}

  private async readLine(): Promise<string> {
    for (;;) {
      const breakAt = this.buffer.indexOf("\r\n");
      if (breakAt >= 0) {
        const line = this.buffer.slice(0, breakAt);
        this.buffer = this.buffer.slice(breakAt + 2);
        return line;
      }
      if (!this.reader) this.reader = this.socket.readable.getReader();
      const { value, done } = await this.reader.read();
      if (done)
        throw new ImapError(502, "메일 서버 연결이 예기치 않게 끊겼습니다.");
      this.buffer += bytesToBinary(value);
    }
  }

  private async readBytes(length: number): Promise<string> {
    while (this.buffer.length < length) {
      if (!this.reader) this.reader = this.socket.readable.getReader();
      const { value, done } = await this.reader.read();
      if (done)
        throw new ImapError(502, "메일 서버 연결이 예기치 않게 끊겼습니다.");
      this.buffer += bytesToBinary(value);
    }
    const chunk = this.buffer.slice(0, length);
    this.buffer = this.buffer.slice(length);
    return chunk;
  }

  /** Reads one protocol line, expanding any `{n}` literal that follows it. */
  private async readUnit(): Promise<string> {
    const line = await this.readLine();
    const literal = /\{(\d+)\}$/.exec(line);
    if (!literal) return line;
    const body = await this.readBytes(Number(literal[1]));
    return `${line}\r\n${body}${await this.readUnit()}`;
  }

  async send(command: string): Promise<ImapResponse> {
    this.tagCounter += 1;
    const tag = `a${this.tagCounter}`;
    if (!this.writer) this.writer = this.socket.writable.getWriter();
    await this.writer.write(
      Uint8Array.from(`${tag} ${command}\r\n`, (character) =>
        character.charCodeAt(0),
      ),
    );
    const lines: string[] = [];
    for (;;) {
      const unit = await this.readUnit();
      const completion = unit.split("\r\n")[0] ?? unit;
      if (isTaggedCompletion(completion, tag))
        return { lines, ...parseCompletion(completion) };
      lines.push(unit);
    }
  }

  private async require(command: string) {
    const response = await this.send(command);
    if (!response.ok)
      throw imapErrorFor(command.split(" ")[0]?.toUpperCase() ?? "");
    return response;
  }

  async connect() {
    await this.readUnit(); // server greeting
    await this.require(
      `LOGIN ${quoteAtom(this.credentials.user)} ${quoteAtom(this.credentials.password)}`,
    );
  }

  async select(mailbox: string) {
    if (this.selected === mailbox) return;
    await this.require(`SELECT ${quoteMailbox(mailbox)}`);
    this.selected = mailbox;
  }

  /** Ascending UIDs of every message in the mailbox. */
  async searchAll(mailbox: string): Promise<number[]> {
    await this.select(mailbox);
    const response = await this.require("UID SEARCH ALL");
    const line = response.lines.find((item) => /^\* SEARCH\b/i.test(item));
    return (
      line
        ?.slice(line.indexOf("SEARCH") + 6)
        .trim()
        .split(/\s+/) ?? []
    )
      .filter((value) => /^\d+$/.test(value))
      .map(Number);
  }

  async fetch(mailbox: string, uids: number[], items: string) {
    if (!uids.length) return [];
    await this.select(mailbox);
    const response = await this.require(
      `UID FETCH ${uids.join(",")} (${items})`,
    );
    return response.lines.filter((line) => /^\* \d+ FETCH\b/i.test(line));
  }

  async listMailboxes(): Promise<string[]> {
    const response = await this.require('LIST "" "*"');
    return response.lines.filter((line) => /^\* LIST\b/i.test(line));
  }

  async createMailbox(name: string) {
    // An existing mailbox answers NO, which is not an error for our purposes.
    await this.send(`CREATE ${quoteMailbox(name)}`);
  }

  async copy(mailbox: string, uid: number, destination: string) {
    await this.select(mailbox);
    const response = await this.send(
      `UID COPY ${uid} ${quoteMailbox(destination)}`,
    );
    return response.ok;
  }

  async markDeleted(mailbox: string, uid: number) {
    await this.select(mailbox);
    await this.require(`UID STORE ${uid} +FLAGS (\\Deleted)`);
    // UIDPLUS is optional, so fall back to expunging the whole mailbox.
    const scoped = await this.send(`UID EXPUNGE ${uid}`);
    if (!scoped.ok) await this.require("EXPUNGE");
  }

  async move(mailbox: string, uid: number, destination: string) {
    if (!(await this.copy(mailbox, uid, destination))) return false;
    await this.markDeleted(mailbox, uid);
    return true;
  }

  async close() {
    try {
      await this.send("LOGOUT");
    } catch {
      // The connection is being torn down either way.
    }
    await this.socket.close().catch(() => undefined);
  }
}

export async function withImap<T>(
  connect: ImapConnect,
  credentials: ImapCredentials,
  action: (connection: ImapConnection) => Promise<T>,
): Promise<T> {
  const socket = connect(
    { hostname: credentials.host, port: credentials.port },
    { secureTransport: "on" },
  );
  const connection = new ImapConnection(socket, credentials);
  try {
    await connection.connect();
    return await action(connection);
  } finally {
    await connection.close();
  }
}
