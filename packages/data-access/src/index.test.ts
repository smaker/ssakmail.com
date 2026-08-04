import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStatus, statusQueryOptions } from "./index";

describe("shared status query", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the shared status endpoint", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { app: "웹", status: "ready" },
    });

    await expect(fetchStatus()).resolves.toEqual({
      app: "웹",
      status: "ready",
    });
    expect(axios.get).toHaveBeenCalledWith("/api/status");
    expect(statusQueryOptions().queryKey).toEqual(["status"]);
  });
});
