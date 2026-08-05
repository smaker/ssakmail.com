import {
  deletePreferenceData,
  getConsent,
  setConsent,
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
