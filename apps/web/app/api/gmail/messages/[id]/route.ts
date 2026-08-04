import { getMessage } from "@ssakmail/gmail";
import type { NextRequest } from "next/server";
import { gmailRoute } from "../../../../../lib/gmail-route";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return gmailRoute(request, (accessToken) => getMessage(accessToken, id));
}
