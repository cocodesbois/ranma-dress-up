// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

describe("application bootstrap", () => {
  it("places preview status and actions in the header without removing the mobile trigger", () => {
    const html = readFileSync(new NodeURL("../index.html", import.meta.url), "utf8");
    const page = new DOMParser().parseFromString(html, "text/html");
    for (const id of ["status-view", "reset-view", "download-look"]) {
      expect(page.querySelectorAll(`#${id}`)).toHaveLength(1);
      expect(page.querySelector(`.site-header #${id}`)).not.toBeNull();
    }
    expect(page.querySelector(".preview-footer")).toBeNull();
    expect(page.querySelector("#wardrobe-view")).not.toBeNull();
  });

  it("reports a missing required preview instead of failing later during setup", async () => {
    document.body.innerHTML = "";
    vi.resetModules();

    await expect(import("../src/main")).rejects.toThrow(
      "Missing or invalid element: #outfit-preview",
    );
  });
});
