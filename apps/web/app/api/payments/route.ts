import { getSubscription } from "@ssakmail/billing/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { billingSession } from "../../../lib/billing";

export async function GET(request: NextRequest) {
  const session = await billingSession(request);
  if (session.response) return session.response;
  return NextResponse.json(
    await getSubscription(session.env, session.email, new Date()),
  );
}
