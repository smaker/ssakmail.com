import { isValidAutoOrganizeConfidence } from "@ssakmail/preference";
import {
  deletePreferenceData,
  getConsent,
  setConsent,
  updateAutoOrganizeSettings,
} from "@ssakmail/preference/cloudflare";
import type { NextRequest } from "next/server";
import { preferenceRoute } from "../../../lib/preference-route";

export const GET = (request: NextRequest) =>
  preferenceRoute(request, getConsent);
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    aiProcessing?: unknown;
    overseasTransfer?: unknown;
  } | null;
  if (body?.aiProcessing !== true || body.overseasTransfer !== true)
    return Response.json(
      { error: "두 동의를 각각 확인해주세요." },
      { status: 400 },
    );
  return preferenceRoute(request, setConsent);
}
export const DELETE = (request: NextRequest) =>
  preferenceRoute(request, deletePreferenceData);

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    enabled?: unknown;
    confidenceThreshold?: unknown;
  } | null;
  if (
    typeof body?.enabled !== "boolean" ||
    typeof body.confidenceThreshold !== "number" ||
    !isValidAutoOrganizeConfidence(body.confidenceThreshold)
  )
    return Response.json(
      { error: "자동 정리 설정이 올바르지 않습니다." },
      { status: 400 },
    );
  return preferenceRoute(request, (env, email) =>
    updateAutoOrganizeSettings(env, email, {
      enabled: body.enabled as boolean,
      confidenceThreshold: body.confidenceThreshold as number,
    }),
  );
}
