export const RECOMMENDATION_CATEGORIES = [
  "advertisement",
  "payment",
  "work",
  "notification",
  "newsletter",
  "personal",
  "other",
] as const;

export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

export type Recommendation = {
  category: RecommendationCategory;
  preferenceScore: number;
  confidence: number;
  reason: string;
  source: "ai" | "rules";
};

export type FeedbackAction =
  | "preferred"
  | "unwanted"
  | "kept"
  | "trashed"
  | "deleted";

export const feedbackWeight = (action: FeedbackAction) =>
  ({ preferred: 3, kept: 2, unwanted: -3, trashed: -4, deleted: -5 })[action];

export const userNamespace = async (email: string) => {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const maskSensitiveText = (text: string) =>
  text
    .replace(/https?:\/\/[^\s]+/gi, "[URL]")
    .replace(/[가-힣]{2,4}(?=님(?:께|,|\s|$))/g, "[이름]")
    .replace(
      /((?:이름|성명|고객명|수신자|받는 사람)\s*[:：]\s*)[^\n,]+/gi,
      "$1[이름]",
    )
    .replace(/((?:주소|배송지)\s*[:：]\s*)[^\n]+/gi, "$1[주소]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[이메일]")
    .replace(/\b\d{6}-?[1-4]\d{6}\b/g, "[주민등록번호]")
    .replace(/\b(?:01[016789])[-. ]?\d{3,4}[-. ]?\d{4}\b/g, "[전화번호]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[결제정보]")
    .replace(
      /((?:인증|승인|보안|OTP)\s*(?:번호|코드)?\s*[:：]?\s*)\d{4,8}\b/gi,
      "$1[인증번호]",
    )
    .replace(/\b\d{10,14}\b/g, "[계좌정보]");

export const parseModelRecommendation = (
  value: unknown,
): Recommendation | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const result = value as Record<string, unknown>;
  if (
    typeof result.category !== "string" ||
    !RECOMMENDATION_CATEGORIES.includes(
      result.category as RecommendationCategory,
    ) ||
    typeof result.preferenceScore !== "number" ||
    result.preferenceScore < 0 ||
    result.preferenceScore > 100 ||
    typeof result.confidence !== "number" ||
    result.confidence < 0 ||
    result.confidence > 1 ||
    typeof result.reason !== "string" ||
    !result.reason.trim() ||
    result.reason.length > 160
  )
    return undefined;
  return {
    category: result.category as RecommendationCategory,
    preferenceScore: Math.round(result.preferenceScore),
    confidence: result.confidence,
    reason: result.reason.trim(),
    source: "ai",
  };
};

export const fallbackRecommendation = (
  message: { category: string; from: string; subject: string },
  history: { senderScore?: number; domainScore?: number } = {},
): Recommendation => {
  const base =
    message.category === "advertisement"
      ? 35
      : message.category === "payment"
        ? 65
        : 50;
  const preferenceScore = clamp(
    base + (history.senderScore ?? 0) * 5 + (history.domainScore ?? 0) * 5,
    0,
    100,
  );
  return {
    category:
      message.category === "advertisement" || message.category === "payment"
        ? message.category
        : "other",
    preferenceScore,
    confidence: 0.55,
    reason:
      history.senderScore || history.domainScore
        ? "이 발신자와 도메인에 대한 이전 선택을 반영했습니다."
        : "메일 유형과 기본 정리 규칙을 반영했습니다.",
    source: "rules",
  };
};
