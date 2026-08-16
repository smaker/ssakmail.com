import { getCloudflareContext } from "@opennextjs/cloudflare";
import { allowPasswordSignup, createPasswordAccount } from "@ssakmail/auth";

const response = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    body =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    return response({ error: "가입 정보를 확인해주세요." }, 400);
  }

  let result: Awaited<ReturnType<typeof createPasswordAccount>>;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const source = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!(await allowPasswordSignup(env.PREFERENCES_DB, source)))
      return response(
        {
          error: "가입 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.",
        },
        429,
      );
    result = await createPasswordAccount(env.PREFERENCES_DB, {
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      name: typeof body.name === "string" ? body.name : undefined,
    });
  } catch {
    return response(
      { error: "가입을 완료하지 못했습니다. 잠시 후 다시 시도해주세요." },
      503,
    );
  }
  if (result.status === "invalid")
    return response({ error: result.error }, 400);
  if (result.status === "exists")
    return response({ error: "이미 가입된 이메일입니다." }, 409);
  return response({ ok: true }, 201);
}
