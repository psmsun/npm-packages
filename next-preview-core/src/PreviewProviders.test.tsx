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

  it("T8 keeps the same QueryClient across re-renders", () => {
    render(<PreviewProviders><Probe /></PreviewProviders>);
    render(<PreviewProviders staleTime={1000}><Probe /></PreviewProviders>);
    render(<PreviewProviders staleTime={0}><Probe /></PreviewProviders>);
    expect(clients.length).toBeGreaterThanOrEqual(3);
    expect(new Set(clients).size).toBe(1);
  });
});

describe("PreviewProviders has no tab-switch refetch (since 2.0)", () => {
  it.each([
    ["no props", {}, 300001],
    ["staleTime={0}", { staleTime: 0 }, 0],
  ])("T7 with %s: a visible visibilitychange and a window focus fetch nothing once the data is stale", async (_, props, wait) => {
    render(<PreviewProviders {...props}><Probe /></PreviewProviders>);
    await flush();
    const invalidate = vi.spyOn(clients[0], "invalidateQueries");
    await flush(wait);
    expect(clients[0].getQueryCache().find({ queryKey: ["page"] })?.isStale()).toBe(true);

    setVisibility("visible");
    changeVisibility();
    focusWindow();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("adds no visibilitychange listener to document", async () => {
    const addDocument = vi.spyOn(document, "addEventListener");
    render(<PreviewProviders><Probe /></PreviewProviders>);
    await flush();
    expect(addDocument.mock.calls.some(([type]) => type === "visibilitychange")).toBe(false);
  });

  it("T7 ignores refetchOnWindowFocus when a JavaScript site still passes it at runtime", async () => {
    const addDocument = vi.spyOn(document, "addEventListener");
    const legacy = { staleTime: 0, refetchOnWindowFocus: true } as Record<string, unknown>;
    render(<PreviewProviders {...(legacy as { staleTime?: number })}><Probe /></PreviewProviders>);
    await flush();
    expect(clients[0].getQueryCache().find({ queryKey: ["page"] })?.isStale()).toBe(true);

    setVisibility("visible");
    changeVisibility();
    focusWindow();
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(addDocument.mock.calls.some(([type]) => type === "visibilitychange")).toBe(false);
  });
});
