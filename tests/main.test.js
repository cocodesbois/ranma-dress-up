// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

describe("application bootstrap", () => {
  it("reports a missing required preview instead of failing later during setup", async () => {
    document.body.innerHTML = "";
    vi.resetModules();

    await expect(import("../src/main.ts")).rejects.toThrow(
      "Missing or invalid element: #outfit-preview",
    );
  });
});
