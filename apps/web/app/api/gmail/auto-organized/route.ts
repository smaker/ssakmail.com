import type { NextRequest } from "next/server";
import { mailRoute } from "../../../../lib/mail-route";

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  return mailRoute(request, (mail) => mail.listAutoOrganized(cursor));
}
