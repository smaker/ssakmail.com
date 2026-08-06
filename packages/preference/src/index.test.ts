import { describe, expect, it } from "vitest";
import {
  autoOrganizeMessages,
  fallbackRecommendation,
  feedbackWeight,
  isConsentCurrent,
  isValidAutoOrganizeConfidence,
  maskSensitiveText,
  POLICY_VERSION,
  parseModelRecommendation,
  shouldAutoOrganize,
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

describe("automatic organization settings", () => {
  it("validates 5-point confidence thresholds", () => {
    expect(isValidAutoOrganizeConfidence(50)).toBe(true);
    expect(isValidAutoOrganizeConfidence(70)).toBe(true);
    expect(isValidAutoOrganizeConfidence(100)).toBe(true);
    expect(isValidAutoOrganizeConfidence(49)).toBe(false);
    expect(isValidAutoOrganizeConfidence(55.5)).toBe(false);
  });

  it("organizes only low-preference mail above the confidence threshold", () => {
    expect(shouldAutoOrganize(39, 0.7, 70)).toBe(true);
    expect(shouldAutoOrganize(40, 1, 50)).toBe(false);
    expect(shouldAutoOrganize(10, 0.69, 70)).toBe(false);
  });

  it("moves only qualifying messages and keeps failures in the inbox", async () => {
    const recommend = async ({ id }: { id: string }) => {
      if (id === "error") throw new Error("analysis failed");
      return {
        category: "advertisement" as const,
        preferenceScore: id === "move" ? 39 : 40,
        confidence: 0.7,
        reason: "test",
        source: "ai" as const,
      };
    };
    const move = async (id: string) => id === "move";

    await expect(
      autoOrganizeMessages(
        [{ id: "move" }, { id: "keep" }, { id: "error" }],
        { enabled: true, confidenceThreshold: 70 },
        recommend,
        move,
      ),
    ).resolves.toEqual([{ id: "keep" }, { id: "error" }]);
  });

  it("does not analyze messages while automatic organization is disabled", async () => {
    const recommend = async () => {
      throw new Error("must not run");
    };
    const messages = [{ id: "m1" }];

    await expect(
      autoOrganizeMessages(
        messages,
        { enabled: false, confidenceThreshold: 70 },
        recommend,
        async () => true,
      ),
    ).resolves.toBe(messages);
  });

  it("rethrows errors the caller marks as fatal", async () => {
    await expect(
      autoOrganizeMessages(
        [{ id: "m1" }],
        { enabled: true, confidenceThreshold: 70 },
        async () => {
          throw new Error("auth failed");
        },
        async () => true,
        () => false,
      ),
    ).rejects.toThrow("auth failed");
  });

  it("keeps rule-based fallbacks in the inbox", async () => {
    const move = async () => true;
    await expect(
      autoOrganizeMessages(
        [{ id: "m1" }],
        { enabled: true, confidenceThreshold: 50 },
        async () => ({
          category: "advertisement",
          preferenceScore: 35,
          confidence: 0.55,
          reason: "fallback",
          source: "rules",
        }),
        move,
      ),
    ).resolves.toEqual([{ id: "m1" }]);
  });
});

describe("consent policy versioning", () => {
  it("accepts a consent given under the current policy", () => {
    expect(
      isConsentCurrent({
        policyVersion: POLICY_VERSION,
        overseasConsentedAt: "2026-08-06T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("asks again when the policy changed, was withdrawn or lacks transfer consent", () => {
    expect(
      isConsentCurrent({
        policyVersion: "2026-08-05",
        overseasConsentedAt: "2026-08-05T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isConsentCurrent({
        policyVersion: POLICY_VERSION,
        overseasConsentedAt: "2026-08-06T00:00:00.000Z",
        withdrawnAt: "2026-08-06T01:00:00.000Z",
      }),
    ).toBe(false);
    expect(isConsentCurrent({ policyVersion: POLICY_VERSION })).toBe(false);
    expect(isConsentCurrent(undefined)).toBe(false);
  });
});
