// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "../src/core/state-store";
import { registerOfflineSupport } from "../src/pwa/register-offline-support";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup() {
  vi.stubEnv("PROD", true);
  const store = createStore({ defaultOutfit: {} });
  const ready = deferred<object>();
  const worker = Object.assign(new EventTarget(), { state: "installing" });
  const registration = { installing: worker, active: null };
  const register = vi.fn().mockResolvedValue(registration);
  vi.stubGlobal("navigator", { serviceWorker: { register, ready: ready.promise } });
  const dispose = registerOfflineSupport(store);
  return { store, ready, worker, register, dispose };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("offline registration", () => {
  it("waits for page load, uses the deployment base and reports readiness", async () => {
    const view = setup();
    expect(view.register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("load"));
    expect(view.register).toHaveBeenCalledExactlyOnceWith(`${import.meta.env.BASE_URL}sw.js`);
    expect(view.store.state.offlineStatus.text).toBe("Preparing offline access...");
    view.ready.resolve({});
    await vi.waitFor(() =>
      expect(view.store.state.offlineStatus.text).toBe("Ready to use offline."),
    );
    view.dispose();
  });

  it("reports failed registration and redundant installation", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = setup();
    view.register.mockRejectedValueOnce(new Error("Registration failed"));
    window.dispatchEvent(new Event("load"));
    await vi.waitFor(() => expect(view.store.state.offlineStatus.isError).toBe(true));
    expect(consoleError).toHaveBeenCalledOnce();
    view.dispose();

    const other = setup();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    other.worker.state = "redundant";
    other.worker.dispatchEvent(new Event("statechange"));
    expect(other.store.state.offlineStatus).toMatchObject({
      text: "Offline setup failed. Reconnect and reload to try again.",
      isError: true,
    });
    other.dispose();
  });

  it("removes pending load and worker listeners on disposal", async () => {
    const beforeLoad = setup();
    beforeLoad.dispose();
    window.dispatchEvent(new Event("load"));
    expect(beforeLoad.register).not.toHaveBeenCalled();

    const duringInstall = setup();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    duringInstall.dispose();
    duringInstall.worker.state = "redundant";
    duringInstall.worker.dispatchEvent(new Event("statechange"));
    duringInstall.ready.resolve({});
    await Promise.resolve();
    await Promise.resolve();
    expect(duringInstall.store.state.offlineStatus).toMatchObject({
      text: "Preparing offline access...",
      isError: false,
    });
  });

  it("does not attach a worker listener if registration finishes after disposal", async () => {
    const view = setup();
    const registration = deferred<object>();
    view.register.mockReturnValueOnce(registration.promise);
    const addListener = vi.spyOn(view.worker, "addEventListener");
    window.dispatchEvent(new Event("load"));
    view.dispose();
    registration.resolve({ installing: view.worker, active: null });
    await Promise.resolve();
    await Promise.resolve();
    expect(addListener).not.toHaveBeenCalled();
    expect(view.store.state.offlineStatus.isError).toBe(false);
  });

  it("does not register outside production", () => {
    const view = setup();
    view.dispose();
    vi.stubEnv("PROD", false);
    const dispose = registerOfflineSupport(view.store);
    window.dispatchEvent(new Event("load"));
    expect(view.register).not.toHaveBeenCalled();
    dispose();
  });
});
