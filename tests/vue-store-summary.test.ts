// @vitest-environment jsdom

import { createApp, nextTick } from "vue";
import { describe, expect, it } from "vitest";
import { createStore } from "../src/core/state-store";
import VueStoreSummary from "../src/ui/vue-store-summary.vue";

describe("Vue store summary", () => {
  it("observes look replacement and item mutations from the shared store", async () => {
    const store = createStore({ defaultOutfit: { hair: "hair", tops: "top" } });
    const host = document.createElement("p");
    const app = createApp(VueStoreSummary, { store });
    app.mount(host);

    expect(host.textContent).toContain("Selected items: 2");

    store.setOutfitItem("tops", null);
    await nextTick();
    expect(host.textContent).toContain("Selected items: 1");

    store.setOutfit({ hair: "new-hair", shoes: "shoes" });
    await nextTick();
    expect(host.textContent).toContain("Selected items: 2");

    store.setOutfitItem("shoes", null);
    await nextTick();
    expect(host.textContent).toContain("Selected items: 1");

    app.unmount();
  });
});
