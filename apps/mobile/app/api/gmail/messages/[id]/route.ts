import type { NextRequest } from "next/server";
import { mailRoute } from "../../../../../lib/mail-route";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return mailRoute(request, (mail) => mail.getMessage(id));
}
