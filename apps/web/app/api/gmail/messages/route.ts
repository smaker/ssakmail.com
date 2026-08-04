import { listMessages } from "@ssakmail/gmail";
import type { NextRequest } from "next/server";
import { gmailRoute } from "../../../../lib/gmail-route";

export async function GET(request: NextRequest) {
  return gmailRoute(request, (accessToken) => listMessages(accessToken));
}
