import { authorizeMailToken, type MailToken } from "@ssakmail/auth";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function mailSession(request: NextRequest) {
  const token = (await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })) as MailToken | null;
  return authorizeMailToken(token);
}
