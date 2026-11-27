<script setup lang="ts">
/**
 * Owns responsive wardrobe controls and preset presentation while delegating
 * look changes to the outfit controller and item presentation to the island.
 * @module ui/wardrobe-panel
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { getMatchingOutfit } from "../core/catalog-model";
import type { Store } from "../core/state-store";
import type { Catalog, Category, Item, OutfitPreset, Sprite } from "../types";
import WardrobeIsland from "./wardrobe-island.vue";

const props = defineProps<{
  catalog: Catalog;
  presets: OutfitPreset[];
  store: Store;
  mobileWardrobe: MediaQueryList;
  getSprite: (item: Item) => Sprite | undefined;
  onCategorySelect: (category: Category) => void;
  onItemSelect: (item: Item) => void;
  onNoneSelect: () => void;
  onPresetSelect: (id: string) => void;
  onAdjacentSelect: (step: number) => void;
}>();

const panel = ref<HTMLElement | null>(null);
const toggle = ref<HTMLButtonElement | null>(null);
const close = ref<HTMLButtonElement | null>(null);
const selectedPreset = computed({
  get: () =>
    props.store.state.pendingPresetId ??
    getMatchingOutfit(props.catalog, props.presets, props.store.state.outfit)?.id ??
    "",
  set: (id: string) => props.onPresetSelect(id),
});

function syncMode() {
  props.store.setMobileWardrobe(props.mobileWardrobe.matches);
  if (!props.mobileWardrobe.matches) {
    props.store.setWardrobeOpen(false);
    props.store.setWardrobeExpanded(false);
  }
}

async function setOpen(open: boolean) {
  if (!props.store.state.mobileWardrobe) return;
  props.store.setWardrobeOpen(open);
  if (!open) props.store.setWardrobeExpanded(false);
  await nextTick();
  if (!props.store.state.mobileWardrobe || props.store.state.wardrobeOpen !== open) return;
  if (open) {
    const categories = panel.value?.querySelector<HTMLElement>(".category-tabs");
    const active = categories?.querySelector<HTMLElement>(".category-tab.is-active");
    if (categories && active) {
      categories.scrollLeft +=
        active.getBoundingClientRect().left - categories.getBoundingClientRect().left;
    }
    close.value?.focus();
  } else {
    toggle.value?.focus();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && props.store.state.wardrobeOpen) void setOpen(false);
}

watch(
  () => [props.store.state.wardrobeOpen, props.store.state.wardrobeExpanded] as const,
  ([open, expanded]) => {
    document.body.classList.toggle("wardrobe-open", open);
    document.body.classList.toggle("wardrobe-expanded", expanded);
  },
  { immediate: true, flush: "sync" },
);

onMounted(() => {
  syncMode();
  props.mobileWardrobe.addEventListener("change", syncMode);
  document.addEventListener("keydown", onKeydown);
});
onUnmounted(() => {
  props.mobileWardrobe.removeEventListener("change", syncMode);
  document.removeEventListener("keydown", onKeydown);
  document.body.classList.remove("wardrobe-open", "wardrobe-expanded");
});
</script>

<template>
  <button
    id="wardrobe-toggle"
    ref="toggle"
    class="button button-secondary wardrobe-trigger"
    type="button"
    aria-controls="wardrobe-panel"
    :aria-expanded="store.state.wardrobeOpen"
    aria-haspopup="dialog"
    @click="setOpen(true)"
  >
    Wardrobe
  </button>
  <button
    id="wardrobe-backdrop"
    class="wardrobe-backdrop"
    type="button"
    aria-label="Close wardrobe"
    tabindex="-1"
    :inert.attr="store.state.wardrobeOpen ? undefined : true"
    @click="setOpen(false)"
  ></button>
  <aside
    id="wardrobe-panel"
    ref="panel"
    class="wardrobe-panel"
    aria-label="Wardrobe"
    :inert.attr="store.state.mobileWardrobe && !store.state.wardrobeOpen ? true : undefined"
    :aria-hidden="store.state.mobileWardrobe ? !store.state.wardrobeOpen : undefined"
    :role="store.state.mobileWardrobe ? 'dialog' : undefined"
    :aria-modal="store.state.mobileWardrobe ? 'false' : undefined"
  >
    <div class="wardrobe-heading">
      <label
        class="outfit-label"
        for="outfit-select"
        >Outfits</label
      >
      <div class="wardrobe-heading-actions">
        <button
          id="wardrobe-size"
          class="button button-secondary wardrobe-size"
          type="button"
          aria-controls="item-list"
          :aria-expanded="store.state.wardrobeExpanded"
          :aria-label="store.state.wardrobeExpanded ? 'Use compact wardrobe' : 'Expand wardrobe'"
          @click="store.setWardrobeExpanded(!store.state.wardrobeExpanded)"
        >
          {{ store.state.wardrobeExpanded ? "Compact" : "Expand" }}
        </button>
        <button
          id="wardrobe-close"
          ref="close"
          class="wardrobe-close"
          type="button"
          aria-label="Close wardrobe"
          @click="setOpen(false)"
        >
          ×
        </button>
      </div>
    </div>
    <div class="outfit-select-row">
      <button
        id="outfit-previous"
        class="button button-secondary outfit-nav-button"
        type="button"
        aria-label="Select previous outfit"
        :disabled="store.state.outfitControlsDisabled"
        @click="onAdjacentSelect(-1)"
      >
        Prev
      </button>
      <select
        id="outfit-select"
        class="outfit-select"
        aria-label="Choose a complete outfit"
        v-model="selectedPreset"
        :disabled="store.state.outfitControlsDisabled"
      >
        <option value="">Custom look</option>
        <option
          v-for="preset in store.state.previewReady ? presets : []"
          :key="preset.id"
          :value="preset.id"
        >
          {{ preset.label }}
        </option>
      </select>
      <button
        id="outfit-next"
        class="button button-secondary outfit-nav-button"
        type="button"
        aria-label="Select next outfit"
        :disabled="store.state.outfitControlsDisabled"
        @click="onAdjacentSelect(1)"
      >
        Next
      </button>
    </div>
    <div
      id="wardrobe-island"
      class="wardrobe-island"
    >
      <WardrobeIsland
        :catalog="catalog"
        :store="store"
        :get-sprite="getSprite"
        :on-category-select="onCategorySelect"
        :on-item-select="onItemSelect"
        :on-none-select="onNoneSelect"
      />
    </div>
  </aside>
</template>
