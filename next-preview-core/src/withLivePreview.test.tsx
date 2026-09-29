// @vitest-environment happy-dom
import { notifyManager, type QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, type ReactNode, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withLivePreview as withLivePreview1016 } from "./__fixtures__/withLivePreview-1.0.16";
import { PreviewProviders } from "./PreviewProviders";
import { type LivePreviewOptions, withLivePreview } from "./withLivePreview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Fake timers delay a 0 ms timer set during a tick by 1 ms, which would hold React Query's notifications.
notifyManager.setScheduler(queueMicrotask);

const LOADING =
  '<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">Loading preview...</div>';
// React reuses the loading div for this block, so `display` keeps the slot it had there.
const NOT_FOUND =
  '<div style="display: grid; height: 50vh; background: white; z-index: 10000; width: 100%; place-content: center; font-size: 36px;">Page not found!</div>';
const NOT_FOUND_FRESH =
  '<div style="height: 50vh; background: white; z-index: 10000; width: 100%; display: grid; place-content: center; font-size: 36px;">Page not found!</div>';
const MESSAGE = (text: string) => `<div style="font-size: 16px;">${text}</div>`;
const ERROR_BLOCK = (line: string, notFound = NOT_FOUND) =>
  notFound.replace("Page not found!", `Preview failed to load.${line}`);

type PageProps = { locale?: string; slug?: string; title?: string; body?: string };

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
let seen: PageProps[];
let errors: unknown[][];
let extraRoots: Root[];

function ClientProbe() {
  client = useQueryClient();
  return null;
}

function Page(props: PageProps) {
  seen.push(props);
  return <main>{props.title}</main>;
}

function render(node: ReactNode, providerProps: { refetchOnWindowFocus?: boolean } = {}) {
  act(() =>
    root.render(
      <PreviewProviders {...providerProps}>
        <ClientProbe />
        {node}
      </PreviewProviders>,
    ),
  );
}

function mount(node: ReactNode) {
  const element = document.createElement("div");
  document.body.append(element);
  const extra = createRoot(element);
  extraRoots.push(extra);
  act(() => extra.render(<PreviewProviders>{node}</PreviewProviders>));
  return element;
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function refetch() {
  act(() => {
    void client.refetchQueries();
  });
}

const previewLogs = () => errors.filter(([first]) => first === "[preview] Fetch failed");

const never = () => new Promise<never>(() => {});

beforeEach(() => {
  vi.useFakeTimers();
  seen = [];
  errors = [];
  extraRoots = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  for (const extra of extraRoots) act(() => extra.unmount());
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
  const known = /^(\[preview\] Fetch failed|Query data cannot be undefined)/;
  expect(errors.filter(([first]) => !known.test(String(first)))).toEqual([]);
});

describe("withLivePreview (1.0.16 behaviour)", () => {
  it("T1 loading block: exact markup, inline style and text", async () => {
    const Preview = withLivePreview(Page, never, () => ["page"]);
    render(<Preview />);
    expect(container.innerHTML).toBe(LOADING);
    await flush(60000);
    expect(container.innerHTML).toBe(LOADING);
  });

  it.each([null, false, 0, ""])("T2 not-found block when the fetcher resolves %j", async (value) => {
    const Preview = withLivePreview(Page, async () => value, () => ["page"]);
    render(<Preview />);
    await flush();
    expect(container.innerHTML).toBe(NOT_FOUND);
    expect(seen).toEqual([]);
  });

  it("T2 not-found block on a first render that finds null in the cache", () => {
    const fetcher = vi.fn(async () => null);
    const Preview = withLivePreview(Page, fetcher, () => ["page"]);
    render(null);
    act(() => client.setQueryData(["page"], null));
    render(<Preview />);
    expect(container.innerHTML).toBe(NOT_FOUND_FRESH);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("T3 renders WrappedComponent with {...props, ...data}; data wins over a prop of the same name", async () => {
    const Preview = withLivePreview(Page, async () => ({ title: "From Strapi", body: "Hello" }), () => ["page"]);
    render(<Preview locale="en" title="From props" />);
    await flush();
    expect(seen.at(-1)).toEqual({ locale: "en", title: "From Strapi", body: "Hello" });
    expect(container.innerHTML).toBe("<main>From Strapi</main>");
  });

  it("T4 uses cacheKeyGenerator(props) as the query key and passes the props to the fetcher", async () => {
    const fetcher = vi.fn(async (_props: PageProps) => ({ title: "About" }));
    const cacheKey = vi.fn((props: PageProps) => ["page", props.locale, props.slug]);
    const Preview = withLivePreview(Page, fetcher, cacheKey);
    render(<Preview locale="en" slug="about" />);
    await flush();
    expect(cacheKey).toHaveBeenCalledWith({ locale: "en", slug: "about" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({ locale: "en", slug: "about" });
    expect(client.getQueryCache().getAll().map((query) => query.queryKey)).toEqual([["page", "en", "about"]]);
    expect(container.innerHTML).toBe("<main>About</main>");
  });
});

describe("without options the output equals the 1.0.16 fixture", () => {
  it.each([
    ["loading", never],
    ["not-found", async () => null],
    ["data", async () => ({ title: "Live" })],
  ])("%s", async (_, fetcher) => {
    const variants = [
      withLivePreview1016(Page, fetcher, () => ["page"]),
      withLivePreview(Page, fetcher, () => ["page"]),
      withLivePreview(Page, fetcher, () => ["page"], {}),
      withLivePreview(Page, fetcher, () => ["page"], { loading: undefined, notFound: undefined, error: undefined }),
    ];
    const views = variants.map((Preview) => mount(<Preview locale="en" />));
    const firstPaint = views.map((view) => view.innerHTML);
    await flush();
    const settled = views.map((view) => view.innerHTML);
    expect(new Set(firstPaint).size).toBe(1);
    expect(new Set(settled).size).toBe(1);
  });
});

const boom = new Error("boom");

const states = {
  loading: { fetcher: never, wait: 0, text: "Loading preview...", html: LOADING },
  notFound: { fetcher: async () => null, wait: 0, text: "Page not found!", html: NOT_FOUND },
  error: {
    fetcher: async (): Promise<never> => {
      throw boom;
    },
    wait: 1000,
    text: "Preview failed to load.",
    html: ERROR_BLOCK(MESSAGE("boom")),
  },
};

type State = keyof typeof states;

async function show(state: State, options: LivePreviewOptions<PageProps> | undefined, props: PageProps = { locale: "zh" }) {
  const Preview = withLivePreview(Page, states[state].fetcher, () => ["page"], options);
  render(<Preview {...props} />);
  await flush();
  await flush(states[state].wait);
  return Preview;
}

describe.each(Object.keys(states) as State[])("options.%s", (state) => {
  const { text, html } = states[state];
  const callArgs = (props: PageProps) => (state === "error" ? [props, boom] : [props]);

  it("O1 left out: the 1.0.16 block", async () => {
    await show(state, {});
    expect(container.innerHTML).toBe(html);
  });

  it("O2 a string: the text inside the default block", async () => {
    await show(state, { [state]: "正在加载" });
    expect(container.innerHTML).toBe(html.replace(text, "正在加载"));
  });

  it("O2 a number: the text inside the default block", async () => {
    await show(state, { [state]: 404 });
    expect(container.innerHTML).toBe(html.replace(text, "404"));
  });

  it("O3 an element replaces the block", async () => {
    await show(state, { [state]: <p className="custom">Custom</p> });
    expect(container.innerHTML).toBe('<p class="custom">Custom</p>');
  });

  it("O3 null renders nothing", async () => {
    await show(state, { [state]: null });
    expect(container.innerHTML).toBe("");
  });

  it("O4 a function gets the props (and the error) on each render; a string result stays in the block", async () => {
    const option = vi.fn((props: PageProps) => `${props.locale}: ${state}`);
    const Preview = await show(state, { [state]: option });
    expect(container.innerHTML).toBe(html.replace(text, `zh: ${state}`));
    expect(option).toHaveBeenLastCalledWith(...callArgs({ locale: "zh" }));
    const calls = option.mock.calls.length;
    render(<Preview locale="en" />);
    expect(container.innerHTML).toBe(html.replace(text, `en: ${state}`));
    expect(option).toHaveBeenLastCalledWith(...callArgs({ locale: "en" }));
    expect(option.mock.calls.length).toBeGreaterThan(calls);
  });

  it("O4 a function returning an element replaces the block", async () => {
    await show(state, { [state]: ({ locale }: PageProps) => <p lang={locale}>Custom</p> });
    expect(container.innerHTML).toBe('<p lang="zh">Custom</p>');
  });
});

describe("error state", () => {
  it("E5 retries once under PreviewProviders before the error block shows", async () => {
    const fetcher = vi.fn(async (): Promise<never> => {
      throw boom;
    });
    const Preview = withLivePreview(Page, fetcher, () => ["page"]);
    render(<Preview />);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe(LOADING);
    await flush(999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe(LOADING);
    expect(previewLogs()).toEqual([]);
    await flush(1);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(container.innerHTML).toBe(ERROR_BLOCK(MESSAGE("boom")));
    await flush(60000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["an Error with a message", new Error("GraphQL 502"), MESSAGE("GraphQL 502")],
    ["a TypeError", new TypeError("Failed to fetch"), MESSAGE("Failed to fetch")],
    ["an Error with an empty message", new Error(""), ""],
    ["an Error with a blank message", new Error("   "), ""],
    ["a string", "GraphQL 502", ""],
    ["a plain object with a message", { message: "GraphQL 502" }, ""],
    ["undefined", undefined, ""],
  ])("E3 default error block when the fetcher throws %s", async (_, thrown, line) => {
    const Preview = withLivePreview(
      Page,
      async (): Promise<never> => {
        throw thrown;
      },
      () => ["page"],
    );
    render(<Preview />);
    await flush();
    await flush(1000);
    expect(container.innerHTML).toBe(ERROR_BLOCK(line));
    expect(previewLogs()).toEqual([["[preview] Fetch failed", ["page"], thrown]]);
  });

  it("E1 the error block comes before not-found when a refetch fails after a null result", async () => {
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw boom;
      return null;
    });
    const Preview = withLivePreview(Page, fetcher, () => ["page"]);
    render(<Preview />);
    await flush();
    expect(container.innerHTML).toBe(NOT_FOUND);
    fail = true;
    refetch();
    await flush();
    await flush(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(container.innerHTML).toBe(ERROR_BLOCK(MESSAGE("boom")));
  });

  it("E2 data from an earlier success wins over a failed refetch", async () => {
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw boom;
      return { title: "Live" };
    });
    const Preview = withLivePreview(Page, fetcher, () => ["page"]);
    render(<Preview />);
    await flush();
    expect(container.innerHTML).toBe("<main>Live</main>");
    fail = true;
    refetch();
    await flush();
    await flush(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(client.getQueryState(["page"])?.status).toBe("error");
    expect(container.innerHTML).toBe("<main>Live</main>");
    expect(previewLogs()).toEqual([["[preview] Fetch failed", ["page"], boom]]);
  });

  it("E4 logs once per distinct error, from an effect and not during render", async () => {
    let count = 0;
    const fetcher = vi.fn(async (): Promise<never> => {
      count += 1;
      throw new Error(`boom ${count}`);
    });
    const logsAtRender: number[] = [];
    const Preview = withLivePreview(Page, fetcher, ({ locale }) => ["page", locale], {
      error: () => {
        logsAtRender.push(previewLogs().length);
        return "Preview failed to load.";
      },
    });
    render(<Preview locale="en" />);
    await flush();
    await flush(1000);
    expect(logsAtRender[0]).toBe(0);
    expect(previewLogs()).toEqual([["[preview] Fetch failed", ["page", "en"], expect.objectContaining({ message: "boom 2" })]]);

    render(<Preview locale="en" />);
    await flush();
    expect(logsAtRender.length).toBeGreaterThan(1);
    expect(previewLogs()).toHaveLength(1);

    refetch();
    await flush();
    await flush(1000);
    expect(previewLogs()).toHaveLength(2);
    expect(previewLogs()[1]).toEqual(["[preview] Fetch failed", ["page", "en"], expect.objectContaining({ message: "boom 4" })]);
  });

  it("E4 logs once when a StrictMode component mounts on a cached error", async () => {
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw boom;
      return null;
    });
    const Preview = withLivePreview(Page, fetcher, () => ["page"]);
    render(<Preview />);
    await flush();
    fail = true;
    refetch();
    await flush();
    await flush(1000);
    expect(previewLogs()).toHaveLength(1);

    render(null);
    render(
      <StrictMode>
        <Preview />
      </StrictMode>,
    );
    await flush();
    expect(container.innerHTML).toBe(ERROR_BLOCK(MESSAGE("boom"), NOT_FOUND_FRESH));
    expect(previewLogs()).toHaveLength(2);
  });

  it("E6 a fetcher resolving undefined is called once and gives not-found, like 1.0.16", async () => {
    const fetcher = vi.fn(async () => undefined);
    const fixtureFetcher = vi.fn(async () => undefined);
    const Preview = withLivePreview(Page, fetcher, () => ["page"]);
    const Preview1016 = withLivePreview1016(Page, fixtureFetcher, () => ["page"]);
    render(<Preview />);
    const view1016 = mount(<Preview1016 />);
    await flush();
    await flush(60000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fixtureFetcher).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe(NOT_FOUND);
    expect(view1016.innerHTML).toBe(NOT_FOUND);
    expect(previewLogs()).toEqual([]);
    expect(errors.filter(([first]) => String(first).startsWith("Query data cannot be undefined"))).toHaveLength(1);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
  ])("E6 an empty %s result is cached: a remount within staleTime shows not-found without a second call", async (_, value) => {
    const fetcher = vi.fn(async () => value);
    const Preview = withLivePreview(Page, fetcher, () => ["page"]);
    render(<Preview />);
    await flush();
    render(null);
    await flush(60000);
    render(<Preview />);
    expect(container.innerHTML).toBe(NOT_FOUND_FRESH);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe(NOT_FOUND_FRESH);
    expect(errors).toEqual([]);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
  ])("E6 an empty %s result is fetched again on a focus refetch with refetchOnWindowFocus", async (_, value) => {
    const fetcher = vi.fn(async () => value);
    const Preview = withLivePreview(Page, fetcher, () => ["page"]);
    render(<Preview />, { refetchOnWindowFocus: true });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(container.innerHTML).toBe(NOT_FOUND);
    expect(errors).toEqual([]);
  });
});
