import { isProviderConfigured } from "@ssakmail/auth";
import { isImapRuntimeAvailable } from "@ssakmail/mail";

export async function GET() {
  return Response.json({
    google: isProviderConfigured("google"),
    microsoft: isProviderConfigured("microsoft"),
    imap: await isImapRuntimeAvailable(),
  });
}
