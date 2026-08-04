import { trashMessage } from "@ssakmail/gmail";
import type { NextRequest } from "next/server";
import { gmailRoute } from "../../../../../../lib/gmail-route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return gmailRoute(request, (accessToken) => trashMessage(accessToken, id));
}
