import { describe, expect, it, vi } from "vitest";
import {
  deletePreferenceData,
  excludeMessageFromAutoOrganize,
  filterUnwantedMessages,
  getAutoOrganizeExcludedIds,
  getAutoOrganizeSettings,
  type PreferenceEnv,
  recommendMessage,
  updateAutoOrganizeSettings,
} from "./cloudflare";
import { userNamespace } from "./index";

const statement = (result: unknown = null, rows: unknown[] = []) => ({
  bind() {
    return this;
  },
  first: async () => result,
  all: async () => ({ results: rows }),
  run: async () => ({}),
});

describe("Cloudflare preference service", () => {
  it("uses enabled 70% defaults when no setting is stored", async () => {
    const env = {
      PREFERENCES_DB: { prepare: () => statement() },
    } as unknown as PreferenceEnv;

    await expect(
      getAutoOrganizeSettings(env, "user@example.com"),
    ).resolves.toEqual({
      enabled: true,
      confidenceThreshold: 70,
    });
  });

  it("rejects confidence thresholds outside the supported range", async () => {
    const env = {
      PREFERENCES_DB: { prepare: () => statement() },
    } as unknown as PreferenceEnv;

    await expect(
      updateAutoOrganizeSettings(env, "user@example.com", {
        confidenceThreshold: 52,
      }),
    ).rejects.toThrow("confidenceThreshold");
  });

  it("rejects non-boolean enabled values", async () => {
    const env = {
      PREFERENCES_DB: { prepare: () => statement() },
    } as unknown as PreferenceEnv;

    await expect(
      updateAutoOrganizeSettings(env, "user@example.com", {
        enabled: "yes" as unknown as boolean,
      }),
    ).rejects.toThrow("enabled");
  });

  it("filters messages previously marked unwanted", async () => {
    const unwantedKey = await userNamespace("m1");
    const env = {
      PREFERENCES_DB: {
        prepare: () => statement(null, [{ message_key: unwantedKey }]),
      },
    } as unknown as PreferenceEnv;

    await expect(
      filterUnwantedMessages(env, "user@example.com", [
        { id: "m1" },
        { id: "m2" },
      ]),
    ).resolves.toEqual([{ id: "m2" }]);
  });

  it("stores and resolves messages restored from automatic organization", async () => {
    const excludedKey = await userNamespace("m1");
    const run = vi.fn().mockResolvedValue({});
    const env = {
      PREFERENCES_DB: {
        prepare: (sql: string) =>
          sql.startsWith("SELECT message_key FROM auto_organize_exclusions")
            ? statement(null, [{ message_key: excludedKey }])
            : { ...statement(), run },
      },
    } as unknown as PreferenceEnv;

    await expect(
      getAutoOrganizeExcludedIds(env, "user@example.com", [
        { id: "m1" },
        { id: "m2" },
      ]),
    ).resolves.toEqual(new Set(["m1"]));
    await excludeMessageFromAutoOrganize(env, "user@example.com", "m1");
    expect(run).toHaveBeenCalledOnce();
  });

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
    const sqlStatements: string[] = [];
    const env = {
      PREFERENCES_DB: {
        prepare: (sql: string) => {
          sqlStatements.push(sql);
          return sql.startsWith("SELECT vector_id")
            ? statement(null, [{ vector_id: "v1" }, { vector_id: "v2" }])
            : statement();
        },
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
    expect(sqlStatements).toContain(
      "DELETE FROM auto_organize_settings WHERE user_key = ?1",
    );
    expect(sqlStatements).toContain(
      "DELETE FROM auto_organize_exclusions WHERE user_key = ?1",
    );
  });
});
