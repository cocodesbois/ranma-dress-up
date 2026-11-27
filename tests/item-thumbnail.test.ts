// @vitest-environment jsdom
import { createApp, h, nextTick, shallowRef } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "../src/data/sprite-catalog";
import ItemThumbnail from "../src/ui/item-thumbnail.vue";
import type { Item, Sprite } from "../src/types";
import { required } from "./fixtures";

const firstItem = catalog.items[0];
const secondItem = catalog.items[1];

function setup(initialSprite: Sprite | undefined) {
  const container = document.createElement("div");
  document.body.append(container);
  const item = shallowRef<Item>(firstItem);
  const sprite = shallowRef(initialSprite);
  const getSprite = vi.fn(() => sprite.value);
  const errors: unknown[] = [];
  const app = createApp({
    render: () => h(ItemThumbnail, { item: item.value, getSprite }),
  });
  app.config.errorHandler = (error) => errors.push(error);
  app.mount(container);
  return { app, container, item, sprite, getSprite, errors };
}

function makeSprite(x = 0, y = 0, scale = 1): Sprite {
  return { image: document.createElement("img"), x, y, width: 100, height: 100, scale };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("item thumbnail", () => {
  it("renders the normal image without looking up or drawing a sprite", () => {
    const view = setup(makeSprite());
    const image = required(view.container.querySelector("img"));
    image.dispatchEvent(new Event("load"));
    expect(image.getAttribute("src")).toBe(
      firstItem.thumbnailSource ?? `images/thumbnails/${firstItem.id}.png`,
    );
    expect(image.getAttribute("alt")).toBe("");
    expect(view.container.querySelector("canvas")).toBeNull();
    expect(view.getSprite).not.toHaveBeenCalled();
    view.app.unmount();
  });

  it("redraws with updated crop geometry for the same item", async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const view = setup(makeSprite());
    required(view.container.querySelector("img")).dispatchEvent(new Event("error"));
    await nextTick();
    view.item.value = {
      ...firstItem,
      thumbnail: { ...firstItem.thumbnail, x: firstItem.thumbnail.x + 10 },
    };
    await nextTick();
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.lastCall?.[1]).toBe(firstItem.thumbnail.x + 10);
    view.app.unmount();
  });

  it("draws the cropped sprite on image failure and redraws only when the sprite changes", async () => {
    const drawImage = vi.fn();
    const clearRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      clearRect,
    } as unknown as CanvasRenderingContext2D);
    const initial = makeSprite(10, 20, 0.5);
    const view = setup(initial);
    required(view.container.querySelector("img")).dispatchEvent(new Event("error"));
    await nextTick();

    const { x, y, width, height } = firstItem.thumbnail;
    const scale = Math.min(88 / width, 88 / height);
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(
      initial.image,
      (x - initial.x) * initial.scale,
      (y - initial.y) * initial.scale,
      width * initial.scale,
      height * initial.scale,
      (112 - width * scale) / 2,
      (112 - height * scale) / 2,
      width * scale,
      height * scale,
    );

    const replacement = makeSprite(30, 40, 0.75);
    view.sprite.value = replacement;
    await nextTick();
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.lastCall?.[0]).toBe(replacement.image);
    expect(clearRect).toHaveBeenCalledTimes(2);
    view.app.unmount();
    view.sprite.value = makeSprite();
    await nextTick();
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it("reports a missing sprite instead of drawing an empty fallback", async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const view = setup(undefined);
    required(view.container.querySelector("img")).dispatchEvent(new Event("error"));
    await nextTick();

    expect(view.errors).toHaveLength(1);
    expect(view.errors[0]).toEqual(new Error(`Image is not loaded: ${firstItem.source}`));
    expect(drawImage).not.toHaveBeenCalled();
    view.app.unmount();
  });

  it("retries the image for a different item and does not retain the old fallback", async () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const view = setup(makeSprite());
    required(view.container.querySelector("img")).dispatchEvent(new Event("error"));
    await nextTick();
    expect(view.container.querySelector("canvas")).not.toBeNull();

    view.item.value = secondItem;
    await nextTick();
    expect(view.container.querySelector("canvas")).toBeNull();
    expect(required(view.container.querySelector("img")).getAttribute("src")).toBe(
      secondItem.thumbnailSource ?? `images/thumbnails/${secondItem.id}.png`,
    );
    expect(drawImage).toHaveBeenCalledOnce();
    view.app.unmount();
  });
});
