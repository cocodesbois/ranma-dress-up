// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppBootstrap } from "../src/app-bootstrap.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(exportPreview) {
  const button = () => document.createElement("button");
  const downloadButton = button();
  const statusController = { setStatusMessage: vi.fn() };
  const onError = vi.fn();
  const canvasRenderer = { exportPreview: vi.fn(exportPreview) };
  const bootstrap = createAppBootstrap({
    preview: document.createElement("canvas"),
    resetButton: button(),
    downloadButton,
    outfitSelect: document.createElement("select"),
    outfitPreviousButton: button(),
    outfitNextButton: button(),
    outfitController: {},
    statusController,
    wardrobePanelController: { bindEvents: vi.fn() },
    canvasRenderer,
    onError,
  });
  bootstrap.bindEvents();
  return { downloadButton, statusController, canvasRenderer, onError };
}

const messages = (statusController) =>
  statusController.setStatusMessage.mock.calls.map(([text]) => text);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let clickedLinks;
beforeEach(() => {
  clickedLinks = [];
  URL.createObjectURL = vi.fn(() => "blob:ranma");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() {
    clickedLinks.push(this);
  });
});
afterEach(() => vi.restoreAllMocks());

describe("download button", () => {
  it("saves the fixed-size export as ranma-dress-up.png", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const { downloadButton, statusController, canvasRenderer, onError } = setup(async () => blob);
    downloadButton.click();
    await settle();

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
  });

  it("is disabled while the image is prepared, then enabled again", async () => {
    const pending = deferred();
    const { downloadButton, canvasRenderer } = setup(() => pending.promise);
    downloadButton.click();
    expect(downloadButton.disabled).toBe(true);
    downloadButton.click();
    expect(canvasRenderer.exportPreview).toHaveBeenCalledOnce();

    pending.resolve(new Blob(["png"]));
    await settle();
    expect(downloadButton.disabled).toBe(false);
  });

  it("reports an image the browser could not encode", async () => {
    const { downloadButton, statusController } = setup(async () => null);
    downloadButton.click();
    await settle();

    expect(clickedLinks).toHaveLength(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(statusController.setStatusMessage).toHaveBeenLastCalledWith(
      "The preview could not be saved.",
      { isError: true },
    );
    expect(downloadButton.disabled).toBe(false);
  });

  it("forwards an export failure to onError and stays usable", async () => {
    const failure = new Error("This browser cannot export the preview.");
    const { downloadButton, onError } = setup(() => Promise.reject(failure));
    downloadButton.click();
    await settle();

    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(clickedLinks).toHaveLength(0);
    expect(downloadButton.disabled).toBe(false);
  });
});
