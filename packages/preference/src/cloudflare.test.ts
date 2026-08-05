import { describe, expect, it, vi } from "vitest";
import {
  deletePreferenceData,
  type PreferenceEnv,
  recommendMessage,
} from "./cloudflare";

const statement = (result: unknown = null, rows: unknown[] = []) => ({
  bind() {
    return this;
  },
  first: async () => result,
  all: async () => ({ results: rows }),
  run: async () => ({}),
});

describe("Cloudflare preference service", () => {
  it("does not call AI without explicit consent", async () => {
    const run = vi.fn();
    const env = {
      PREFERENCES_DB: { prepare: () => statement() },
      PREFERENCE_VECTORS: {
        query: vi.fn(),
        upsert: vi.fn(),
        deleteByIds: vi.fn(),
      },
      AI: { run },
    } as unknown as PreferenceEnv;

    await expect(
      recommendMessage(env, "user@example.com", {
        id: "m1",
        from: "sender@example.com",
        subject: "안내",
        snippet: "요약",
        body: "본문",
        category: "other",
      }),
    ).resolves.toEqual({ enabled: false });
    expect(run).not.toHaveBeenCalled();
  });

  it("deletes stored vectors before all user preference rows", async () => {
    const deleteByIds = vi.fn().mockResolvedValue({});
    const env = {
      PREFERENCES_DB: {
        prepare: (sql: string) =>
          sql.startsWith("SELECT vector_id")
            ? statement(null, [{ vector_id: "v1" }, { vector_id: "v2" }])
            : statement(),
      },
      PREFERENCE_VECTORS: {
        query: vi.fn(),
        upsert: vi.fn(),
        deleteByIds,
      },
      AI: { run: vi.fn() },
    } as unknown as PreferenceEnv;

    await deletePreferenceData(env, "user@example.com");
    expect(deleteByIds).toHaveBeenCalledWith(["v1", "v2"]);
  });
});
