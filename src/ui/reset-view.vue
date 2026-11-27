<script setup lang="ts">
/**
 * Presents the reset action, delegating changes to the outfit controller.
 * @module ui/reset-view
 */
defineProps<{ onReset: () => void }>();
</script>

<template>
  <button
    id="reset-look"
    class="button button-secondary"
    type="button"
    @click="onReset()"
  >
    <svg
      class="button-icon"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="currentColor"
      />
      <path
        d="M22 13a7 7 0 1 0-1 8 M22 8v5h-5"
        fill="none"
        stroke="var(--button-surface)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    Reset
  </button>
</template>
