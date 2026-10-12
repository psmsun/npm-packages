// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true}}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineYoutubeCover } from "./youtubeCover.js";

const VIDEO = "https://www.youtube.com/watch?v=mFX_vPKZ7hE";
const OTHER = "https://www.youtube.com/shorts/I3ye9D7gSRo";
const maxres = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
const hq = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const player = (id: string) => `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
const ALLOW = "autoplay; encrypted-media; picture-in-picture; fullscreen";
const XSS = `"><img src=x onerror=alert(1)>`;

let errors: unknown[][];
beforeEach(() => {
  errors = [];
  // happy-dom is told not to load iframe pages and reports each skipped load through console.error.
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  for (const [error] of errors) expect(String(error)).toContain("Iframe page loading is disabled");
});

defineYoutubeCover();

let tags = 0;
const freshTag = () => `youtube-cover-test-${++tags}`;

const cover = (attributes: Record<string, string> = {}, tag = "youtube-cover"): HTMLElement => {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
};

const parts = (element: HTMLElement) => {
  const root = element.shadowRoot!;
  return {
    root,
    button: root.querySelector("button"),
    img: root.querySelector("img"),
    iframe: root.querySelector("iframe"),
  };
};

const play = (element: HTMLElement) => parts(element).button!.click();
const isPlaying = (element: HTMLElement) => parts(element).iframe !== null;
const onCover = (element: HTMLElement) =>
  parts(element).button !== null && parts(element).iframe === null;

// Counts every write to src, including a write of the same value.
const srcWrites = (img: HTMLImageElement) => {
  const observer = new MutationObserver(() => {});
  observer.observe(img, { attributeFilter: ["src"] });
  let count = 0;
  return () => (count += observer.takeRecords().length);
};

const setNaturalWidth = (img: HTMLImageElement, width: number) =>
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true });

describe("defineYoutubeCover", () => {
  it("registers youtube-cover by default", () => {
    expect(customElements.get("youtube-cover")).toBeDefined();
  });

  it("can be called twice; the first constructor stays registered", () => {
    const tag = freshTag();
    defineYoutubeCover(tag);
    const first = customElements.get(tag);
    expect(first).toBeDefined();
    expect(() => defineYoutubeCover(tag)).not.toThrow();
    expect(customElements.get(tag)).toBe(first);
    expect(() => defineYoutubeCover()).not.toThrow();
  });

  it("works under a custom tag name", () => {
    const tag = freshTag();
    defineYoutubeCover(tag);
    const { button, img } = parts(cover({ url: VIDEO }, tag));
    expect(button).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(maxres("mFX_vPKZ7hE"));
  });

  it("does nothing where customElements is missing", () => {
    vi.stubGlobal("customElements", undefined);
    try {
      expect(defineYoutubeCover(freshTag())).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("upgrades an element that was in the DOM, with attributes, before define", () => {
    const tag = freshTag();
    const element = cover({ url: VIDEO, label: "Watch the keynote" }, tag);
    expect(element.shadowRoot).toBeNull();

    defineYoutubeCover(tag);
    const { button, img } = parts(element);
    expect(button!.getAttribute("aria-label")).toBe("Watch the keynote");
    expect(img!.getAttribute("src")).toBe(maxres("mFX_vPKZ7hE"));

    play(element);
    expect(parts(element).iframe!.getAttribute("src")).toBe(player("mFX_vPKZ7hE"));
  });
});

describe("rendering", () => {
  it.each([
    ["no url", {}],
    ["an empty url", { url: "" }],
    ["another host", { url: "https://evil.example/watch?v=mFX_vPKZ7hE" }],
    ["a channel", { url: "https://www.youtube.com/@pharmtech" }],
    ["a bare id", { url: "mFX_vPKZ7hE" }],
    ["a quote in the id", { url: `https://www.youtube.com/watch?v=mFX_vPKZ7h"` }],
  ])("renders only the style for %s", (_, attributes) => {
    const { root } = parts(cover(attributes));
    expect([...root.children].map((child) => child.localName)).toEqual(["style"]);
  });

  it("renders a button with the maxres thumbnail and a play icon", () => {
    const { root, button, img } = parts(cover({ url: VIDEO }));
    expect(button!.getAttribute("type")).toBe("button");
    expect(button!.getAttribute("aria-label")).toBe("Play video");
    expect(img!.parentNode).toBe(button);
    expect(img!.getAttribute("alt")).toBe("");
    expect(img!.getAttribute("src")).toBe(maxres("mFX_vPKZ7hE"));
    expect(img!.getAttribute("loading")).toBe("lazy");
    expect(img!.getAttribute("decoding")).toBe("async");

    const icon = button!.querySelector(".play")!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.querySelector("svg")!.getAttribute("fill")).toBe("currentColor");
    expect(root.querySelectorAll("iframe")).toHaveLength(0);
  });

  it.each([
    ["before", { label: "Watch the keynote", url: VIDEO }],
    ["after", { url: VIDEO, label: "Watch the keynote" }],
  ])("uses label as the button's aria-label, set %s url", (_, attributes) => {
    const { button } = parts(cover(attributes));
    expect(button!.getAttribute("aria-label")).toBe("Watch the keynote");
  });

  it("falls back to Play video for an empty label", () => {
    const { button } = parts(cover({ url: VIDEO, label: "" }));
    expect(button!.getAttribute("aria-label")).toBe("Play video");
  });

  it.each([
    ["before", { label: XSS, url: VIDEO }],
    ["after", { url: VIDEO, label: XSS }],
  ])("keeps a label made of markup as an attribute value, set %s url", (_, attributes) => {
    const element = cover(attributes);
    const { root, button } = parts(element);
    expect(root.querySelectorAll("img")).toHaveLength(1);
    expect(root.querySelectorAll("[onerror]")).toHaveLength(0);
    expect(button!.getAttribute("aria-label")).toBe(XSS);

    play(element);
    expect(root.querySelectorAll("img")).toHaveLength(0);
    expect(root.querySelectorAll("[onerror]")).toHaveLength(0);
    expect(parts(element).iframe!.getAttribute("title")).toBe(XSS);
  });

  it("swaps the thumbnail when url changes on the cover", () => {
    const element = cover({ url: VIDEO, label: "Watch" });
    element.setAttribute("url", OTHER);

    const { root, button, img } = parts(element);
    expect([...root.children].map((child) => child.localName)).toEqual(["style", "button"]);
    expect(button!.getAttribute("aria-label")).toBe("Watch");
    expect(img!.getAttribute("src")).toBe(maxres("I3ye9D7gSRo"));

    element.setAttribute("url", "https://www.youtube.com/@pharmtech");
    expect([...root.children].map((child) => child.localName)).toEqual(["style"]);
  });

  it("defines no url or label property, so React 19 sets attributes", () => {
    const element = cover({ url: VIDEO, label: "Watch" });
    expect("url" in element).toBe(false);
    expect("label" in element).toBe(false);
  });

  it("styles the shadow root with every documented custom property", () => {
    const css = parts(cover({ url: VIDEO })).root.querySelector("style")!.textContent;
    for (const property of [
      "--youtube-cover-button-bg",
      "--youtube-cover-button-radius",
      "--youtube-cover-button-size",
      "--youtube-cover-button-backdrop",
      "--youtube-cover-icon-color",
      "--youtube-cover-icon-size",
      "--youtube-cover-focus-color",
    ]) {
      expect(css).toContain(`var(${property},`);
    }
  });

  it("draws the focus ring on a positioned ::after, not as an outline the thumbnail paints over", () => {
    const css = parts(cover({ url: VIDEO })).root.querySelector("style")!.textContent!;
    const ring = css.match(/button:focus-visible::after \{([^}]*)\}/)?.[1] ?? "";
    expect(ring).toContain('content: ""');
    expect(ring).toContain("position: absolute");
    expect(ring).toContain("inset: 4px");
    expect(ring).toContain("border: 2px solid var(--youtube-cover-focus-color, #fff)");
    expect(css).not.toMatch(/outline/);
  });
});

describe("thumbnail fallback", () => {
  it("swaps to hqdefault on error, once", () => {
    const img = parts(cover({ url: VIDEO })).img!;
    const writes = srcWrites(img);

    img.dispatchEvent(new Event("error"));
    expect(img.getAttribute("src")).toBe(hq("mFX_vPKZ7hE"));
    expect(writes()).toBe(1);

    img.dispatchEvent(new Event("error"));
    expect(img.getAttribute("src")).toBe(hq("mFX_vPKZ7hE"));
    expect(writes()).toBe(1);
  });

  it("swaps to hqdefault when a 120px placeholder loads, once", () => {
    const img = parts(cover({ url: VIDEO })).img!;
    const writes = srcWrites(img);

    setNaturalWidth(img, 120);
    img.dispatchEvent(new Event("load"));
    expect(img.getAttribute("src")).toBe(hq("mFX_vPKZ7hE"));
    expect(writes()).toBe(1);

    img.dispatchEvent(new Event("load"));
    img.dispatchEvent(new Event("error"));
    expect(img.getAttribute("src")).toBe(hq("mFX_vPKZ7hE"));
    expect(writes()).toBe(1);
  });

  it.each([121, 1280])("keeps maxres when it loads at %ipx", (width) => {
    const img = parts(cover({ url: VIDEO })).img!;
    const writes = srcWrites(img);

    setNaturalWidth(img, width);
    img.dispatchEvent(new Event("load"));
    expect(img.getAttribute("src")).toBe(maxres("mFX_vPKZ7hE"));
    expect(writes()).toBe(0);
  });
});

describe("playing", () => {
  it("replaces the button with the player and announces it", () => {
    const element = cover({ url: VIDEO, label: "Watch the keynote" });
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    document.addEventListener("youtube-cover-play", listener);
    try {
      play(element);
    } finally {
      document.removeEventListener("youtube-cover-play", listener);
    }

    const { root, button, iframe } = parts(element);
    expect(button).toBeNull();
    expect([...root.children].map((child) => child.localName)).toEqual(["style", "iframe"]);
    expect(iframe!.getAttribute("src")).toBe(player("mFX_vPKZ7hE"));
    expect(iframe!.getAttribute("allow")).toBe(ALLOW);
    expect(iframe!.hasAttribute("allowfullscreen")).toBe(true);
    expect(iframe!.getAttribute("title")).toBe("Watch the keynote");

    expect(events).toHaveLength(1);
    expect(events[0].target).toBe(element);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
    expect(events[0].detail).toEqual({ id: "mFX_vPKZ7hE" });
  });

  it("titles the player Play video without a label", () => {
    const element = cover({ url: OTHER });
    play(element);
    expect(parts(element).iframe!.getAttribute("title")).toBe("Play video");
    expect(parts(element).iframe!.getAttribute("src")).toBe(player("I3ye9D7gSRo"));
  });

  it("moves focus to the player without scrolling", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const element = cover({ url: VIDEO });
    play(element);

    const { root, iframe } = parts(element);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(focus.mock.contexts[0]).toBe(iframe);
    expect(root.activeElement).toBe(iframe);
    expect(document.activeElement).toBe(element);
  });

  it("plays one video at a time", () => {
    const a = cover({ url: VIDEO, label: "A" });
    const b = cover({ url: OTHER, label: "B" });

    play(a);
    expect(isPlaying(a)).toBe(true);

    play(b);
    expect(isPlaying(b)).toBe(true);
    expect(onCover(a)).toBe(true);
    expect(parts(a).button!.getAttribute("aria-label")).toBe("A");
    expect(parts(a).img!.getAttribute("src")).toBe(maxres("mFX_vPKZ7hE"));

    play(a);
    expect(isPlaying(a)).toBe(true);
    expect(onCover(b)).toBe(true);
  });

  it("tells a cover in another shadow root apart from itself", () => {
    const outer = cover({ url: VIDEO });
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const nested = document.createElement("youtube-cover");
    nested.setAttribute("url", OTHER);
    shadow.append(nested);
    document.body.append(host);

    // happy-dom leaves event.target on the nested cover; a browser shows document listeners the shadow host.
    const retarget = (event: Event) => {
      if (event.composedPath().includes(shadow)) {
        Object.defineProperty(event, "target", { value: host, configurable: true });
      }
    };
    let seen: EventTarget | null = null;
    const see = (event: Event) => {
      seen = event.target;
    };
    window.addEventListener("youtube-cover-play", retarget, { capture: true });
    document.addEventListener("youtube-cover-play", see);
    try {
      play(outer);
      play(nested);
      expect(seen).toBe(host);
      expect(isPlaying(nested)).toBe(true);
      expect(onCover(outer)).toBe(true);

      play(outer);
      expect(seen).toBe(outer);
      expect(isPlaying(outer)).toBe(true);
      expect(onCover(nested)).toBe(true);
    } finally {
      window.removeEventListener("youtube-cover-play", retarget, { capture: true });
      document.removeEventListener("youtube-cover-play", see);
    }
  });

  it("goes back to the cover for a new url", () => {
    const element = cover({ url: VIDEO });
    play(element);
    element.setAttribute("url", OTHER);

    expect(onCover(element)).toBe(true);
    expect(parts(element).img!.getAttribute("src")).toBe(maxres("I3ye9D7gSRo"));

    play(element);
    expect(parts(element).iframe!.getAttribute("src")).toBe(player("I3ye9D7gSRo"));
  });

  it("renders nothing when the url turns invalid while playing", () => {
    const element = cover({ url: VIDEO });
    play(element);
    element.setAttribute("url", "https://evil.example/watch?v=mFX_vPKZ7hE");
    expect([...parts(element).root.children].map((child) => child.localName)).toEqual(["style"]);
  });

  it("retitles the player in place when label changes", () => {
    const element = cover({ url: VIDEO, label: "Before" });
    play(element);
    const { iframe } = parts(element);

    element.setAttribute("label", "After");
    expect(parts(element).iframe).toBe(iframe);
    expect(iframe!.getAttribute("title")).toBe("After");

    element.removeAttribute("label");
    expect(parts(element).iframe).toBe(iframe);
    expect(iframe!.getAttribute("title")).toBe("Play video");
  });

  it("relabels the button when label changes on the cover", () => {
    const element = cover({ url: VIDEO, label: "Before" });
    element.setAttribute("label", "After");
    expect(parts(element).button!.getAttribute("aria-label")).toBe("After");
  });

  it("keeps a label set while playing for the cover it returns to", () => {
    const a = cover({ url: VIDEO, label: "Before" });
    const b = cover({ url: OTHER });
    play(a);
    a.setAttribute("label", "After");
    play(b);
    expect(parts(a).button!.getAttribute("aria-label")).toBe("After");
  });

  it("stops listening once removed from the DOM", () => {
    const a = cover({ url: VIDEO });
    const b = cover({ url: OTHER });
    play(a);
    a.remove();

    expect(() => play(b)).not.toThrow();
    expect(isPlaying(b)).toBe(true);
    // Still listening, the removed cover would have gone back to its thumbnail.
    expect(isPlaying(a)).toBe(true);
  });
});
