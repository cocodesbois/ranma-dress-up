// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppBootstrap } from "../src/app-bootstrap";

function deferred() {
  let resolve!: (value: Blob | null) => void;
  const promise = new Promise<Blob | null>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup(exportPreview: () => Promise<Blob | null>) {
  const statusController = {
    setStatusMessage:
      vi.fn<(text: string, options?: { loading?: boolean; isError?: boolean }) => void>(),
    setOutfitControlsDisabled: vi.fn(),
  };
  const onError = vi.fn();
  const canvasRenderer = {
    exportPreview: vi.fn(exportPreview),
    drawOutfit: vi.fn(),
    resizePreview: vi.fn(),
    watchDevicePixelRatio: vi.fn(() => vi.fn()),
  };
  let downloadPending = false;
  const setDownloadPending = vi.fn((pending: boolean) => {
    downloadPending = pending;
  });
  const bootstrap = createAppBootstrap({
    preview: document.createElement("canvas"),
    outfitController: { startApp: vi.fn(async () => {}) },
    statusController,
    canvasRenderer,
    onError,
    isDownloadPending: () => downloadPending,
    setDownloadPending,
  });
  return { bootstrap, statusController, canvasRenderer, onError, setDownloadPending };
}

const messages = (statusController: ReturnType<typeof setup>["statusController"]) =>
  statusController.setStatusMessage.mock.calls.map(([text]) => text);

let clickedLinks: HTMLAnchorElement[];
beforeEach(() => {
  clickedLinks = [];
  URL.createObjectURL = vi.fn(() => "blob:ranma");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(
    this: HTMLAnchorElement,
  ) {
    clickedLinks.push(this);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("download action", () => {
  it("saves the fixed-size export as ranma-dress-up.png", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const { bootstrap, statusController, canvasRenderer, onError, setDownloadPending } = setup(
      async () => blob,
    );
    await bootstrap.downloadPreview();

    expect(canvasRenderer.exportPreview).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickedLinks).toHaveLength(1);
    expect(clickedLinks[0].download).toBe("ranma-dress-up.png");
    expect(clickedLinks[0].href).toBe("blob:ranma");
    expect(messages(statusController)).toEqual([
      "Preparing your look...",
      "Your look has been downloaded.",
    ]);
    expect(onError).not.toHaveBeenCalled();
    expect(setDownloadPending.mock.calls.map(([pending]) => pending)).toEqual([true, false]);
  });

  it("starts once and disconnects its resize observer and density listener on disposal", () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    class TestResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const { bootstrap, canvasRenderer } = setup(async () => null);
    bootstrap.start();
    bootstrap.start();
    expect(observe).toHaveBeenCalledOnce();
    expect(canvasRenderer.watchDevicePixelRatio).toHaveBeenCalledOnce();
    bootstrap.dispose();
    bootstrap.dispose();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(canvasRenderer.watchDevicePixelRatio.mock.results[0].value).toHaveBeenCalledOnce();
  });

  it("ignores duplicate requests while the export is pending", async () => {
    const pending = deferred();
    const { bootstrap, canvasRenderer, setDownloadPending } = setup(() => pending.promise);
    const firstDownload = bootstrap.downloadPreview();
    await bootstrap.downloadPreview();
    expect(canvasRenderer.exportPreview).toHaveBeenCalledOnce();

    pending.resolve(new Blob(["png"]));
    await firstDownload;
    expect(setDownloadPending.mock.calls.map(([isPending]) => isPending)).toEqual([true, false]);
  });

  it("reports an image the browser could not encode", async () => {
    const { bootstrap, statusController } = setup(async () => null);
    await bootstrap.downloadPreview();

    expect(clickedLinks).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(statusController.setStatusMessage).toHaveBeenLastCalledWith(
      "The preview could not be saved.",
      { isError: true },
    );
  });

  it("forwards an export failure to onError and stays usable", async () => {
    const failure = new Error("This browser cannot export the preview.");
    const { bootstrap, onError, setDownloadPending } = setup(() => Promise.reject(failure));
    await bootstrap.downloadPreview();

    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(clickedLinks).toHaveLength(0);
    expect(setDownloadPending.mock.calls.map(([pending]) => pending)).toEqual([true, false]);
  });
});
