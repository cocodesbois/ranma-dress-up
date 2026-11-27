<script setup lang="ts">
/**
 * Presents an item thumbnail and draws its decoded sprite if the image fails.
 * Receives catalog geometry and a sprite lookup without making image caches reactive.
 * @module ui/item-thumbnail
 */
import { ref, watch, watchPostEffect } from "vue";
import type { Item, Sprite } from "../types";

const props = defineProps<{
  item: Item;
  getSprite: (item: Item) => Sprite | undefined;
}>();

const imageFailed = ref(false);
const canvas = ref<HTMLCanvasElement | null>(null);

watch(
  [() => props.item.id, () => props.item.thumbnailSource],
  () => {
    imageFailed.value = false;
  },
  { flush: "sync" },
);

watchPostEffect(() => {
  if (!imageFailed.value || !canvas.value) return;
  const context = canvas.value.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot create item thumbnails.");
  }
  const sprite = props.getSprite(props.item);
  if (!sprite) {
    throw new Error(`Image is not loaded: ${props.item.source}`);
  }

  const { x, y, width: sourceWidth, height: sourceHeight } = props.item.thumbnail;
  const scale = Math.min(88 / sourceWidth, 88 / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.clearRect(0, 0, 112, 112);
  context.drawImage(
    sprite.image,
    (x - sprite.x) * sprite.scale,
    (y - sprite.y) * sprite.scale,
    sourceWidth * sprite.scale,
    sourceHeight * sprite.scale,
    (112 - width) / 2,
    (112 - height) / 2,
    width,
    height,
  );
});
</script>

<template>
  <img
    v-if="!imageFailed"
    :key="`${item.id}:${item.thumbnailSource ?? ''}`"
    class="item-thumbnail"
    :src="item.thumbnailSource ?? `images/thumbnails/${item.id}.png`"
    alt=""
    loading="lazy"
    decoding="async"
    @error="imageFailed = true"
  />
  <canvas
    v-else
    ref="canvas"
    class="item-thumbnail"
    width="112"
    height="112"
  />
</template>
