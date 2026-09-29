// @vitest-environment happy-dom
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { PreviewProviders } from "./PreviewProviders";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null;
let clients: QueryClient[];
let fetcher: Mock<() => Promise<{ title: string }>>;

function Probe() {
  clients.push(useQueryClient());
  useQuery({ queryKey: ["page"], queryFn: fetcher });
  return null;
}

function render(node: ReactNode) {
  act(() => root!.render(node));
}

function unmount() {
  act(() => root!.unmount());
  root = null;
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

function focusWindow() {
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

function changeVisibility() {
  act(() => {
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  clients = [];
  fetcher = vi.fn(async () => ({ title: "Home" }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) unmount();
  container.remove();
  delete (document as { visibilityState?: unknown }).visibilityState;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PreviewProviders (1.0.16 behaviour)", () => {
  it("T5 defaults: staleTime 300000, refetchOnWindowFocus false, retry 1", () => {
    render(<PreviewProviders><Probe /></PreviewProviders>);
    expect(clients[0].getDefaultOptions().queries).toEqual({
      staleTime: 300000,
      refetchOnWindowFocus: false,
      retry: 1,
    });
  });

  it("T6 with refetchOnWindowFocus: focus and a visible visibilitychange refetch active queries, a hidden one does not", async () => {
    render(<PreviewProviders refetchOnWindowFocus><Probe /></PreviewProviders>);
    await flush();
    const inactive = vi.fn(async () => "inactive");
    await act(() => clients[0].prefetchQuery({ queryKey: ["inactive"], queryFn: inactive }));
    expect(fetcher).toHaveBeenCalledTimes(1);

    focusWindow();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);

    setVisibility("visible");
    changeVisibility();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(3);

    setVisibility("hidden");
    changeVisibility();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(inactive).toHaveBeenCalledTimes(1);
  });

  it("T6 with refetchOnWindowFocus: removes both listeners on unmount", async () => {
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    render(<PreviewProviders refetchOnWindowFocus><Probe /></PreviewProviders>);
    await flush();
    const invalidate = vi.spyOn(clients[0], "invalidateQueries");
    const onFocus = addWindow.mock.calls.find(([type]) => type === "focus")?.[1];
    const onVisibility = addDocument.mock.calls.find(([type]) => type === "visibilitychange")?.[1];
    expect(onFocus).toBeTypeOf("function");
    expect(onVisibility).toBeTypeOf("function");

    unmount();
    expect(removeWindow).toHaveBeenCalledWith("focus", onFocus);
    expect(removeDocument).toHaveBeenCalledWith("visibilitychange", onVisibility);

    focusWindow();
    changeVisibility();
    await flush();
    expect(invalidate).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("T7 with refetchOnWindowFocus false: no refetch on either event, even once the data is stale", async () => {
    render(<PreviewProviders><Probe /></PreviewProviders>);
    await flush();
    const invalidate = vi.spyOn(clients[0], "invalidateQueries");

    focusWindow();
    changeVisibility();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await flush(300001);
    focusWindow();
    changeVisibility();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("T8 keeps the same QueryClient across re-renders", () => {
    render(<PreviewProviders><Probe /></PreviewProviders>);
    render(<PreviewProviders staleTime={1000}><Probe /></PreviewProviders>);
    render(<PreviewProviders refetchOnWindowFocus><Probe /></PreviewProviders>);
    expect(clients.length).toBeGreaterThanOrEqual(3);
    expect(new Set(clients).size).toBe(1);
  });
});
