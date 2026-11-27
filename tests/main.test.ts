// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

describe("application bootstrap", () => {
  it("leaves one Vue application root for the owned shell and preview", () => {
    const html = readFileSync(new NodeURL("../index.html", import.meta.url), "utf8");
    const page = new DOMParser().parseFromString(html, "text/html");
    expect(page.querySelectorAll("#app")).toHaveLength(1);
    expect(page.querySelector(".site-header")).toBeNull();
    expect(page.querySelector("#outfit-preview")).toBeNull();
  });

  it("reports a missing application root during setup", async () => {
    document.body.innerHTML = "";
    vi.resetModules();

    await expect(import("../src/main")).rejects.toThrow("Missing or invalid element: #app");
  });
});
