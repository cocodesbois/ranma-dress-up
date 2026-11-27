<script setup lang="ts">
/**
 * Displays the selected-item count from the readonly reactive app store.
 * @module ui/vue-store-summary
 */

import { computed } from "vue";
import type { Store } from "../core/state-store";

const props = defineProps<{ store: Store }>();
const selectedItemCount = computed(
  () =>
    Object.values(props.store.state.outfit).filter(
      (itemId) => itemId !== null && itemId !== undefined,
    ).length,
);
</script>

<template>
  <span>Selected items: {{ selectedItemCount }}</span>
</template>
