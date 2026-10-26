// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true}}
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type UtmSearchParams, useUtmIframe } from "./useUtmIframe.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const params = (query: string): UtmSearchParams => new URLSearchParams(query);

function Probe({ searchParams, deps }: { searchParams: UtmSearchParams; deps?: unknown[] }) {
  useUtmIframe("crm", searchParams, deps);
  return null;
}

let iframe: HTMLIFrameElement;
let root: Root;

function iframeWith(src: string) {
  iframe = document.createElement("iframe");
  iframe.id = "crm";
  iframe.src = src;
  document.body.append(iframe);
  return vi.spyOn(iframe, "src", "set");
}

beforeEach(() => {
  // Iframe page loading is off (docblock above), so happy-dom logs each src instead of fetching it.
  vi.spyOn(console, "error").mockImplementation(() => {});
  root = createRoot(document.createElement("div"));
});

afterEach(() => {
  act(() => root.unmount());
  iframe.remove();
  vi.restoreAllMocks();
});

describe("useUtmIframe", () => {
  test.each([
    ["a bare src", "https://crm.example.com/form", "https://crm.example.com/form?utm_source=x"],
    ["the CRM's own query, unchanged", "https://crm.example.com/form?name=a+b&q=%7E", "https://crm.example.com/form?name=a+b&q=%7E&utm_source=x"],
    ["a fragment", "https://crm.example.com/form#section", "https://crm.example.com/form?utm_source=x#section"],
    ["a query and a fragment", "https://crm.example.com/form?id=7#section", "https://crm.example.com/form?id=7&utm_source=x#section"],
    ["a ? inside the fragment", "https://crm.example.com/form#step?2", "https://crm.example.com/form?utm_source=x#step?2"],
  ])("puts the UTMs in the query of %s", (_, src, expected) => {
    iframeWith(src);
    act(() => root.render(createElement(Probe, { searchParams: params("utm_source=x") })));
    expect(iframe.src).toBe(expected);
  });

  test("leaves one copy under StrictMode, and sets src once", () => {
    const setSrc = iframeWith("https://crm.example.com/form?id=7#section");
    act(() => root.render(createElement(StrictMode, null, createElement(Probe, { searchParams: params("utm_source=x") }))));
    expect(iframe.src).toBe("https://crm.example.com/form?id=7&utm_source=x#section");
    expect(setSrc).toHaveBeenCalledTimes(1);
  });

  test("sets src once for a value the browser re-encodes, under StrictMode and an unchanged re-run", () => {
    const setSrc = iframeWith("https://crm.example.com/form");
    const searchParams = params("utm_source=O'Brien");
    act(() => root.render(createElement(StrictMode, null, createElement(Probe, { searchParams, deps: [1] }))));
    act(() => root.render(createElement(StrictMode, null, createElement(Probe, { searchParams, deps: [2] }))));
    expect(iframe.src).toBe("https://crm.example.com/form?utm_source=O%27Brien");
    expect(setSrc).toHaveBeenCalledTimes(1);
  });

  test("replaces the UTMs when a deps change brings a new campaign", () => {
    iframeWith("https://crm.example.com/form?id=7#section");
    act(() => root.render(createElement(Probe, { searchParams: params("utm_source=x&utm_campaign=a"), deps: [1] })));
    act(() => root.render(createElement(Probe, { searchParams: params("utm_source=y&utm_campaign=b"), deps: [2] })));
    expect(iframe.src).toBe("https://crm.example.com/form?id=7&utm_campaign=b&utm_source=y#section");
  });
});
