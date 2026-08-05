import { findLabel, listMessagesByLabel } from "@ssakmail/gmail";
import type { NextRequest } from "next/server";
import { gmailRoute } from "../../../../lib/gmail-route";

export async function GET(request: NextRequest) {
  return gmailRoute(request, async (accessToken) => {
    const label = await findLabel(accessToken);
    return label?.id ? listMessagesByLabel(accessToken, label.id) : [];
  });
}
