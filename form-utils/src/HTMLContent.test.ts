// @vitest-environment happy-dom
import { act, createElement, type ReactElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HTMLContent as HTMLContent121 } from "./__fixtures__/HTMLContent-1.2.1.js";
import { HTMLContent } from "./HTMLContent.js";
import { RECAPTCHA_NET_HOST, rewriteRecaptchaHost } from "./recaptcha.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// No <script> in anything mounted here: happy-dom would try to fetch it.
const RECAPTCHA = `<div class="g-recaptcha" data-src="https://www.google.com/recaptcha/api.js?render=explicit"></div><a href="https://www.google.com/maps">Map</a>`;
const PLAIN = `<form action="https://itegroup.activehosted.com/proc.php"><label>Email <input name="email" type="email"></label><button type="submit">Send</button></form>`;
const SIMPLE_EMBED = `<div class="_form_12"></div><script src="https://itegroup.activehosted.com/f/embed.php?id=12" type="text/javascript" charset="utf-8"></script>`;
const FULL_EMBED = `${PLAIN}<script src="https://www.google.com/recaptcha/api.js" async defer></script>`;
const PROPS = { id: "f12", className: "container-registration", "data-form": "12" };

let errors: unknown[][];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(element: ReactElement): string {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  const html = container.innerHTML;
  act(() => root.unmount());
  container.remove();
  return html;
}

function renderOnServer(element: ReactElement): string {
  vi.stubGlobal("window", undefined);
  try {
    return renderToStaticMarkup(element);
  } finally {
    vi.unstubAllGlobals();
  }
}

describe("without recaptchaHost, as 1.2.1", () => {
  it.each([
    ["reCAPTCHA markup", RECAPTCHA],
    ["a form", PLAIN],
  ])("injects the same DOM — %s", (_, html) => {
    const injected = mount(createElement(HTMLContent, { html, ...PROPS }));
    expect(injected).toBe(mount(createElement(HTMLContent121, { html, ...PROPS })));
    expect(injected).toContain(html.slice(0, 20));
    expect(errors).toEqual([]);
  });

  it.each([
    ["a simple embed", SIMPLE_EMBED],
    ["the full embed code", FULL_EMBED],
  ])("renders the same markup on the server — %s", (_, html) => {
    const markup = renderOnServer(createElement(HTMLContent, { html, ...PROPS }));
    expect(markup).toBe(renderOnServer(createElement(HTMLContent121, { html, ...PROPS })));
    expect(markup).toBe('<div id="f12" class="container-registration" data-form="12"></div>');
    expect(errors).toEqual([]);
  });

  it("logs the same for an empty html", () => {
    mount(createElement(HTMLContent, { html: "" }));
    const logged = errors.splice(0);
    mount(createElement(HTMLContent121, { html: "" }));
    expect(logged).toEqual(errors);
    expect(logged).toEqual([["html prop can't be null"]]);
  });
});

describe("with recaptchaHost", () => {
  it("rewrites the reCAPTCHA host before inserting", () => {
    const injected = mount(createElement(HTMLContent, { html: RECAPTCHA, recaptchaHost: RECAPTCHA_NET_HOST, ...PROPS }));
    expect(injected).toContain("https://www.recaptcha.net/recaptcha/api.js?render=explicit");
    expect(injected).toContain("https://www.google.com/maps");
    expect(injected).not.toContain("www.google.com/recaptcha/");
    expect(injected).toBe(mount(createElement(HTMLContent121, { html: rewriteRecaptchaHost(RECAPTCHA), ...PROPS })));
  });

  it("uses a custom host", () => {
    expect(mount(createElement(HTMLContent, { html: RECAPTCHA, recaptchaHost: "recaptcha.example.cn" }))).toContain(
      "https://recaptcha.example.cn/recaptcha/api.js",
    );
  });

  it("keeps recaptchaHost off the DOM", () => {
    const injected = mount(createElement(HTMLContent, { html: PLAIN, recaptchaHost: RECAPTCHA_NET_HOST, ...PROPS }));
    expect(injected.toLowerCase()).not.toContain("recaptchahost");
    expect(injected).toBe(mount(createElement(HTMLContent121, { html: PLAIN, ...PROPS })));
    expect(renderOnServer(createElement(HTMLContent, { html: FULL_EMBED, recaptchaHost: RECAPTCHA_NET_HOST, ...PROPS }))).toBe(
      renderOnServer(createElement(HTMLContent121, { html: FULL_EMBED, ...PROPS })),
    );
  });

  it("logs once on the server for a simple embed", () => {
    renderOnServer(createElement(HTMLContent, { html: SIMPLE_EMBED, recaptchaHost: RECAPTCHA_NET_HOST, id: 12 }));
    expect(errors).toEqual([
      [
        "[form] Form 12 is an ActiveCampaign simple embed (embed.php): its reCAPTCHA host cannot be switched to www.recaptcha.net. Use the full embed code.",
      ],
    ]);
    renderOnServer(createElement(HTMLContent, { html: SIMPLE_EMBED, recaptchaHost: RECAPTCHA_NET_HOST }));
    expect(errors[1][0]).toMatch(/^\[form\] A form is an ActiveCampaign simple embed \(embed\.php\)/);
  });

  it("stays quiet for the full embed code", () => {
    renderOnServer(createElement(HTMLContent, { html: FULL_EMBED, recaptchaHost: RECAPTCHA_NET_HOST, id: 12 }));
    expect(errors).toEqual([]);
  });
});

describe("the simple-embed warning in the browser", () => {
  const LOADER = `<div data-loader="https://itegroup.activehosted.com/f/embed.php?id=12"></div>`;
  const WARNING =
    "[form] Form 12 is an ActiveCampaign simple embed (embed.php): its reCAPTCHA host cannot be switched to www.recaptcha.net. Use the full embed code.";

  it("logs once on mount, with the server's text", () => {
    mount(createElement(HTMLContent, { html: LOADER, recaptchaHost: RECAPTCHA_NET_HOST, id: 12 }));
    expect(errors).toEqual([[WARNING]]);
    mount(createElement(HTMLContent, { html: LOADER, recaptchaHost: RECAPTCHA_NET_HOST }));
    expect(errors[1][0]).toMatch(/^\[form\] A form is an ActiveCampaign simple embed \(embed\.php\)/);
  });

  it("logs once under StrictMode", () => {
    mount(createElement(StrictMode, null, createElement(HTMLContent, { html: LOADER, recaptchaHost: RECAPTCHA_NET_HOST, id: 12 })));
    expect(errors).toEqual([[WARNING]]);
  });

  it("logs once per html value, not per render", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const other = LOADER.replace("id=12", "id=13");
    act(() => root.render(createElement(HTMLContent, { html: LOADER, recaptchaHost: RECAPTCHA_NET_HOST, id: 12 })));
    act(() => root.render(createElement(HTMLContent, { html: LOADER, recaptchaHost: RECAPTCHA_NET_HOST, id: 12, className: "x" })));
    expect(errors).toHaveLength(1);
    act(() => root.render(createElement(HTMLContent, { html: other, recaptchaHost: RECAPTCHA_NET_HOST, id: 12 })));
    expect(errors).toEqual([[WARNING], [WARNING]]);
    act(() => root.unmount());
  });

  it("stays quiet for the full embed code with recaptchaHost set", () => {
    mount(createElement(HTMLContent, { html: `${PLAIN}${RECAPTCHA}`, recaptchaHost: RECAPTCHA_NET_HOST, id: 12 }));
    expect(errors).toEqual([]);
  });

  it("stays quiet for a simple embed without recaptchaHost, and injects what 1.2.1 injects", () => {
    const injected = mount(createElement(HTMLContent, { html: LOADER, ...PROPS }));
    expect(injected).toBe(mount(createElement(HTMLContent121, { html: LOADER, ...PROPS })));
    expect(errors).toEqual([]);
  });
});
