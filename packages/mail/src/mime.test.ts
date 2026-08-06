import { describe, expect, it } from "vitest";
import {
  binaryToBytes,
  bytesToBinary,
  decodeEncodedWords,
  decodeModifiedUtf7,
  decodeQuotedPrintable,
  encodeModifiedUtf7,
  parseHeaders,
  parseMessage,
} from "./mime";

const binary = (text: string) => bytesToBinary(new TextEncoder().encode(text));

describe("byte and text conversion", () => {
  it("round-trips bytes through the binary string form", () => {
    const bytes = Uint8Array.from([0, 13, 10, 200, 255]);

    expect(binaryToBytes(bytesToBinary(bytes))).toEqual(bytes);
  });
});

describe("quoted printable", () => {
  it("decodes escapes and drops soft line breaks", () => {
    expect(
      new TextDecoder().decode(decodeQuotedPrintable("caf=C3=A9=\r\n bar")),
    ).toBe("café bar");
  });
});

describe("RFC 2047 encoded words", () => {
  it("decodes a base64 UTF-8 subject", () => {
    expect(decodeEncodedWords("=?UTF-8?B?7JWI64WV?=")).toBe("안녕");
  });

  it("decodes a quoted printable word and its underscore spaces", () => {
    expect(decodeEncodedWords("=?UTF-8?Q?caf=C3=A9_bar?=")).toBe("café bar");
  });

  it("joins adjacent encoded words without inserting whitespace", () => {
    expect(decodeEncodedWords("=?UTF-8?B?7JWI?= =?UTF-8?B?64WV?=")).toBe(
      "안녕",
    );
  });

  it("decodes EUC-KR, which Korean mail servers still send", () => {
    expect(decodeEncodedWords("=?EUC-KR?B?vsibem21?=")).not.toContain("=?");
  });

  it("leaves plain text and undecodable words untouched", () => {
    expect(decodeEncodedWords("Plain subject")).toBe("Plain subject");
    expect(decodeEncodedWords("=?UNKNOWN-X?B?!!!?=")).toContain("=?");
  });
});

describe("header parsing", () => {
  it("unfolds continuation lines and lowercases names", () => {
    const headers = parseHeaders("Subject: first\r\n  second\r\nFrom: a@b.com");

    expect(headers.get("subject")).toBe("first second");
    expect(headers.get("from")).toBe("a@b.com");
  });

  it("keeps the first value when a header repeats", () => {
    expect(parseHeaders("X: one\r\nX: two").get("x")).toBe("one");
  });
});

describe("message parsing", () => {
  it("reads a plain text message", () => {
    const parsed = parseMessage(
      binary(
        [
          "From: 보낸이 <a@b.com>",
          "Subject: 제목",
          "Date: Wed, 05 Aug 2026 01:02:03 +0900",
          "Content-Type: text/plain; charset=UTF-8",
          "",
          "본문입니다",
        ].join("\r\n"),
      ),
    );

    expect(parsed).toMatchObject({ subject: "제목", text: "본문입니다" });
    expect(parsed.date).toBe(
      String(Date.parse("Wed, 05 Aug 2026 01:02:03 +0900")),
    );
  });

  it("picks the text and HTML alternatives out of a multipart body", () => {
    const parsed = parseMessage(
      binary(
        [
          'Content-Type: multipart/alternative; boundary="B1"',
          "",
          "--B1",
          "Content-Type: text/plain; charset=UTF-8",
          "",
          "텍스트",
          "--B1",
          "Content-Type: text/html; charset=UTF-8",
          "",
          "<p>HTML</p>",
          "--B1--",
          "",
        ].join("\r\n"),
      ),
    );

    expect(parsed.text.trim()).toBe("텍스트");
    expect(parsed.html.trim()).toBe("<p>HTML</p>");
  });

  it("decodes a base64 body", () => {
    const parsed = parseMessage(
      [
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        btoa(bytesToBinary(new TextEncoder().encode("안녕하세요"))),
      ].join("\r\n"),
    );

    expect(parsed.text.trim()).toBe("안녕하세요");
  });

  it("falls back to placeholders when headers are missing", () => {
    expect(parseMessage("\r\n\r\nbody")).toMatchObject({
      from: "알 수 없는 발신자",
      subject: "제목 없음",
      date: "",
    });
  });
});

describe("modified UTF-7 mailbox names", () => {
  it.each(["INBOX", "싹메일 자동정리함", "a&b", "Trash"])(
    "round-trips %s",
    (name) => {
      expect(decodeModifiedUtf7(encodeModifiedUtf7(name))).toBe(name);
    },
  );

  it("leaves ASCII names unencoded", () => {
    expect(encodeModifiedUtf7("INBOX")).toBe("INBOX");
  });

  it("encodes Korean names with the modified alphabet", () => {
    const encoded = encodeModifiedUtf7("휴지통");

    expect(encoded.startsWith("&")).toBe(true);
    expect(encoded.endsWith("-")).toBe(true);
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });
});
