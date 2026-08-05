import { describe, expect, it } from "vitest";
import {
  fallbackRecommendation,
  feedbackWeight,
  maskSensitiveText,
  parseModelRecommendation,
  userNamespace,
} from "./index";

describe("sensitive mail masking", () => {
  it("masks identity, verification, payment, and secret URL values", () => {
    const masked = maskSensitiveText(
      "홍길동님 test@example.com 010-1234-5678 900101-1234567 인증번호 123456 카드 1234-5678-9012-3456 주소: 서울시 강남구 테스트로 1 https://example.com/reset/secret?token=secret&email=test@example.com",
    );

    expect(masked).not.toContain("test@example.com");
    expect(masked).not.toContain("홍길동");
    expect(masked).not.toContain("서울시 강남구");
    expect(masked).not.toContain("010-1234-5678");
    expect(masked).not.toContain("900101-1234567");
    expect(masked).not.toContain("123456");
    expect(masked).not.toContain("1234-5678-9012-3456");
    expect(masked).not.toContain("token=secret");
    expect(masked).not.toContain("reset/secret");
    expect(masked).toContain("[이메일]");
    expect(masked).toContain("[인증번호]");
  });
});

describe("recommendation validation", () => {
  it("accepts a bounded structured model result", () => {
    expect(
      parseModelRecommendation({
        category: "newsletter",
        preferenceScore: 78,
        confidence: 0.86,
        reason: "최근 유지한 개발 뉴스레터와 유사합니다.",
      }),
    ).toEqual({
      category: "newsletter",
      preferenceScore: 78,
      confidence: 0.86,
      reason: "최근 유지한 개발 뉴스레터와 유사합니다.",
      source: "ai",
    });
  });

  it.each([
    { category: "unknown", preferenceScore: 50, confidence: 0.5, reason: "x" },
    {
      category: "advertisement",
      preferenceScore: 101,
      confidence: 0.5,
      reason: "x",
    },
    {
      category: "advertisement",
      preferenceScore: 50,
      confidence: 2,
      reason: "x",
    },
    {
      category: "advertisement",
      preferenceScore: 50,
      confidence: 0.5,
      reason: "",
    },
  ])("rejects unsafe model output", (value) => {
    expect(parseModelRecommendation(value)).toBeUndefined();
  });
});

describe("fallback recommendation", () => {
  it("combines mail category and explicit user feedback", () => {
    expect(
      fallbackRecommendation(
        {
          category: "advertisement",
          from: "news@example.com",
          subject: "할인",
        },
        { senderScore: -3, domainScore: -2 },
      ),
    ).toMatchObject({
      preferenceScore: 10,
      source: "rules",
    });
  });
});

describe("personalization identity", () => {
  it("derives a stable namespace without exposing the email", async () => {
    const first = await userNamespace("Person@Example.com");
    const second = await userNamespace("person@example.com");

    expect(first).toBe(second);
    expect(first).not.toContain("person");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ["preferred", 3],
    ["kept", 2],
    ["unwanted", -3],
    ["trashed", -4],
    ["deleted", -5],
  ] as const)("weights %s feedback", (action, expected) => {
    expect(feedbackWeight(action)).toBe(expected);
  });
});
