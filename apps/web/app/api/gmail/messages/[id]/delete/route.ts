import { deleteMessage } from "@ssakmail/gmail";
import type { NextRequest } from "next/server";
import { gmailRoute } from "../../../../../../lib/gmail-route";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return gmailRoute(request, (accessToken) => deleteMessage(accessToken, id));
}
