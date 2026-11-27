<script setup lang="ts">
/**
 * Presents controller status from the shared reactive store.
 * @module ui/status-view
 */
import type { Store } from "../core/state-store";

defineProps<{ store: Store }>();
</script>

<template>
  <p
    id="status-message"
    class="status-message"
    :class="{ 'is-loading': store.state.status.loading, 'is-error': store.state.status.isError }"
    role="status"
    aria-live="polite"
  >
    {{ store.state.status.text }}
  </p>
</template>
