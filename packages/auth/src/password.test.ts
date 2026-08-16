import { describe, expect, it } from "vitest";
import type { PasswordDatabase } from "./password";
import {
  createPasswordAccount,
  hashPassword,
  validatePasswordCredentials,
  verifyPassword,
} from "./password";

describe("password authentication", () => {
  it("hashes credentials and rejects invalid input", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(
      verifyPassword("correct horse battery staple", {
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
      }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword("not the password", {
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
      }),
    ).resolves.toBe(false);
    expect(
      validatePasswordCredentials({ email: "not-an-email", password: "short" }),
    ).toEqual({ error: "올바른 이메일 주소를 입력해주세요." });
  });

  it("creates a normalized account through prepared statements", async () => {
    const queries: string[] = [];
    let activeQuery = "";
    let activeValues: Array<string | number | null> = [];
    let insertedId: string | undefined;
    const statement = {
      bind: (...values: Array<string | number | null>) => {
        activeValues = values;
        return statement;
      },
      first: async <T>() => {
        if (activeQuery.startsWith("SELECT id FROM auth_users") && insertedId)
          return { id: insertedId } as T;
        return null;
      },
      run: async () => {
        if (activeQuery.startsWith("INSERT OR IGNORE INTO auth_users"))
          insertedId = String(activeValues[0]);
      },
    };
    const db = {
      prepare(query: string) {
        activeQuery = query;
        queries.push(query);
        return statement;
      },
    } as PasswordDatabase;

    const result = await createPasswordAccount(db, {
      email: "  Person@Example.com ",
      password: "correct horse battery staple",
      name: "Person",
    });
    expect(result.status).toBe("created");
    expect(queries).toHaveLength(3);
    expect(queries[0]).toContain("SELECT id FROM auth_users");
    expect(queries[1]).toContain("INSERT OR IGNORE INTO auth_users");
    expect(queries[2]).toContain("SELECT id FROM auth_users");
  });
});
