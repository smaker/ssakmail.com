/**
 * Minimal MIME reader for IMAP mailboxes.
 *
 * Everything works on a "binary string" (one character per byte, produced by a
 * latin1 decode) so that structural scanning stays byte accurate while each
 * body part is decoded with its own declared charset — Korean mailboxes still
 * send a lot of EUC-KR.
 */

export const bytesToBinary = (bytes: Uint8Array) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return binary;
};

export const binaryToBytes = (binary: string) =>
  Uint8Array.from(binary, (character) => character.charCodeAt(0) & 0xff);

export const decodeCharset = (bytes: Uint8Array, charset?: string) => {
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
};

/** Throws on an unknown charset so the caller can keep the original text. */
const decodeCharsetStrict = (bytes: Uint8Array, charset: string) =>
  new TextDecoder(charset).decode(bytes);

const HIGH_BIT = /[\u0080-\u00ff]/;

/**
 * Headers should be ASCII with RFC 2047 encoded words, but 8-bit UTF-8 headers
 * do turn up in the wild and would otherwise render as mojibake.
 */
export const decodeUtf8Header = (value: string) => {
  if (!HIGH_BIT.test(value)) return value;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      binaryToBytes(value),
    );
  } catch {
    return value;
  }
};

export const decodeBase64 = (value: string) =>
  binaryToBytes(atob(value.replace(/[^A-Za-z0-9+/=]/g, "")));

export const decodeQuotedPrintable = (value: string) => {
  const joined = value.replace(/=(?:\r\n|\n|\r)/g, "");
  const bytes: number[] = [];
  for (let index = 0; index < joined.length; index += 1) {
    const character = joined[index] as string;
    const hex = joined.slice(index + 1, index + 3);
    if (character === "=" && /^[0-9a-f]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }
    bytes.push(character.charCodeAt(0) & 0xff);
  }
  return Uint8Array.from(bytes);
};

/** RFC 2047 encoded words, e.g. `=?EUC-KR?B?uLLA1A==?=`. */
export const decodeEncodedWords = (value: string) =>
  decodeUtf8Header(value)
    // Whitespace between two adjacent encoded words is not part of the text.
    .replace(/(\?=)\s+(=\?)/g, "$1$2")
    .replace(
      /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
      (match, charset: string, encoding: string, text: string) => {
        try {
          const bytes =
            encoding.toUpperCase() === "B"
              ? decodeBase64(text)
              : decodeQuotedPrintable(text.replace(/_/g, " "));
          return decodeCharsetStrict(bytes, charset);
        } catch {
          return match;
        }
      },
    );

export type MimeHeaders = Map<string, string>;

export const parseHeaders = (raw: string): MimeHeaders => {
  const headers: MimeHeaders = new Map();
  // Unfold continuation lines before splitting.
  for (const line of raw.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!headers.has(name)) headers.set(name, value);
  }
  return headers;
};

export const splitHeadersAndBody = (raw: string) => {
  const boundary = raw.search(/\r?\n\r?\n/);
  return boundary < 0
    ? { headers: parseHeaders(raw), body: "" }
    : {
        headers: parseHeaders(raw.slice(0, boundary)),
        body: raw.slice(boundary).replace(/^\r?\n\r?\n/, ""),
      };
};

export const parameterOf = (headerValue: string, name: string) => {
  const quoted = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(headerValue);
  if (quoted) return quoted[1];
  return new RegExp(`${name}\\s*=\\s*([^;\\s]+)`, "i").exec(headerValue)?.[1];
};

const decodePart = (body: string, headers: MimeHeaders) => {
  const encoding = (
    headers.get("content-transfer-encoding") ?? ""
  ).toLowerCase();
  const charset = parameterOf(headers.get("content-type") ?? "", "charset");
  const bytes =
    encoding === "base64"
      ? decodeBase64(body)
      : encoding === "quoted-printable"
        ? decodeQuotedPrintable(body)
        : binaryToBytes(body);
  return decodeCharset(bytes, charset);
};

const splitMultipart = (body: string, boundary: string) =>
  body
    .split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
    .slice(1, -1)
    .map((part) => part.replace(/^\r?\n/, ""));

export type MimeBody = { text: string; html: string };

/** Walks the MIME tree and keeps the first text and HTML alternative found. */
export const readMimeBody = (
  body: string,
  headers: MimeHeaders,
  depth = 0,
): MimeBody => {
  const contentType = (headers.get("content-type") ?? "text/plain")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  const boundary = parameterOf(headers.get("content-type") ?? "", "boundary");

  if (contentType?.startsWith("multipart/") && boundary && depth < 10) {
    const collected: MimeBody = { text: "", html: "" };
    for (const part of splitMultipart(body, boundary)) {
      const parsed = splitHeadersAndBody(part);
      const nested = readMimeBody(parsed.body, parsed.headers, depth + 1);
      collected.text ||= nested.text;
      collected.html ||= nested.html;
      if (collected.text && collected.html) break;
    }
    return collected;
  }
  if (contentType === "text/html")
    return { text: "", html: decodePart(body, headers) };
  if (contentType === "text/plain" || !contentType)
    return { text: decodePart(body, headers), html: "" };
  return { text: "", html: "" };
};

export type ParsedMessage = {
  from: string;
  subject: string;
  date: string;
  text: string;
  html: string;
};

/** `date` is epoch milliseconds as a string, matching the Gmail mapper. */
export const parseMessage = (raw: string): ParsedMessage => {
  const { headers, body } = splitHeadersAndBody(raw);
  const parsedDate = Date.parse(headers.get("date") ?? "");
  const { text, html } = readMimeBody(body, headers);
  return {
    from: decodeEncodedWords(headers.get("from") ?? "") || "알 수 없는 발신자",
    subject: decodeEncodedWords(headers.get("subject") ?? "") || "제목 없음",
    date: Number.isNaN(parsedDate) ? "" : String(parsedDate),
    text,
    html,
  };
};

/** IMAP mailbox names travel as modified UTF-7 (RFC 3501 §5.1.3). */
export const encodeModifiedUtf7 = (name: string) => {
  let encoded = "";
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    const bytes: number[] = [];
    for (const character of buffer) {
      const code = character.charCodeAt(0);
      // Modified UTF-7 encodes UTF-16 code units, big endian.
      bytes.push(code >> 8, code & 0xff);
    }
    encoded += `&${btoa(String.fromCharCode(...bytes))
      .replace(/=+$/, "")
      .replace(/\//g, ",")}-`;
    buffer = "";
  };
  for (const character of name) {
    const code = character.charCodeAt(0);
    if (code === 0x26) {
      flush();
      encoded += "&-";
    } else if (code >= 0x20 && code <= 0x7e) {
      flush();
      encoded += character;
    } else {
      buffer += character;
    }
  }
  flush();
  return encoded;
};

export const decodeModifiedUtf7 = (name: string) =>
  name.replace(/&([^-]*)-/g, (_, encoded: string) => {
    if (!encoded) return "&";
    const bytes = decodeBase64(
      encoded.replace(/,/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "="),
    );
    let decoded = "";
    for (let index = 0; index + 1 < bytes.length; index += 2)
      decoded += String.fromCharCode(
        ((bytes[index] as number) << 8) | (bytes[index + 1] as number),
      );
    return decoded;
  });
