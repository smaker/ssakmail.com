import { authorizeGoogleToken, type GoogleToken } from "@ssakmail/auth";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function gmailSession(request: NextRequest) {
  const token = (await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })) as GoogleToken | null;
  return authorizeGoogleToken(token);
}
