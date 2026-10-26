// @vitest-environment happy-dom
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NB_ERROR_ID, NB_POLL_INTERVAL_MS, type NeverBounceListener, showValidationMessage } from "./form-utils.js";
import { useNeverBounceEmailGate } from "./useNeverBounceEmailGate.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const listener = { forceUpdate: vi.fn(), destroy: vi.fn() };
const registerListener = vi.fn((_input: HTMLInputElement, _showBlurFeedback?: boolean): NeverBounceListener => listener);
const stubNeverBounce = () => {
  window._nb = { fields: { registerListener } };
};

function Gate() {
  const containerRef = useRef<HTMLDivElement>(null);
  useNeverBounceEmailGate(containerRef);
  return createElement("div", { ref: containerRef });
}

let host: HTMLDivElement;
let root: Root | null;

function mount(): HTMLDivElement {
  act(() => root!.render(createElement(Gate)));
  return host.firstElementChild as HTMLDivElement;
}

function unmount() {
  act(() => root!.unmount());
  root = null;
}

// MutationObserver records arrive in a microtask.
const mutationsDelivered = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  registerListener.mockClear();
  listener.destroy.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  if (root) unmount();
  host.remove();
  delete window._nb;
  vi.useRealTimers();
});

const fakeIntervals = () => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

describe("useNeverBounceEmailGate", () => {
  test("wires a form whose email input arrives after the form, exactly once", async () => {
    stubNeverBounce();
    const container = mount();
    container.innerHTML = "<form></form>";
    await mutationsDelivered();
    expect(registerListener).not.toHaveBeenCalled();
    const form = container.querySelector("form")!;
    form.innerHTML = `<input type="email" name="email"><button type="submit">Send</button>`;
    await mutationsDelivered();
    form.append(document.createElement("span"));
    await mutationsDelivered();
    expect(registerListener).toHaveBeenCalledTimes(1);
    expect(registerListener).toHaveBeenCalledWith(form.querySelector("input"), false);
  });

  test("waits for window._nb with one poll, however many mutations arrive", async () => {
    fakeIntervals();
    const container = mount();
    container.innerHTML = `<form><input type="email" name="email"></form>`;
    await mutationsDelivered();
    container.querySelector("form")!.append(document.createElement("span"));
    await mutationsDelivered();
    container.querySelector("form")!.append(document.createElement("span"));
    await mutationsDelivered();
    expect(vi.getTimerCount()).toBe(1);
    stubNeverBounce();
    vi.advanceTimersByTime(NB_POLL_INTERVAL_MS);
    expect(registerListener).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("retries on a later mutation when window._nb arrives before the email input", async () => {
    fakeIntervals();
    const container = mount();
    container.innerHTML = "<form></form>";
    await mutationsDelivered();
    stubNeverBounce();
    vi.advanceTimersByTime(NB_POLL_INTERVAL_MS);
    expect(registerListener).not.toHaveBeenCalled();
    container.querySelector("form")!.innerHTML = `<input type="email" name="email">`;
    await mutationsDelivered();
    expect(registerListener).toHaveBeenCalledTimes(1);
  });

  test("gives up after 50 polls, and later mutations start no new wait", async () => {
    fakeIntervals();
    const container = mount();
    container.innerHTML = `<form><input type="email" name="email"></form>`;
    await mutationsDelivered();
    vi.advanceTimersByTime(NB_POLL_INTERVAL_MS * 51);
    expect(vi.getTimerCount()).toBe(0);
    container.querySelector("form")!.append(document.createElement("span"));
    await mutationsDelivered();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("clears its poll on unmount", async () => {
    fakeIntervals();
    const container = mount();
    container.innerHTML = "<form></form>";
    await mutationsDelivered();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("keeps the wiring through later mutations, and removes it on unmount", async () => {
    fakeIntervals();
    const container = mount();
    container.innerHTML = `<form><input type="email" name="email"></form>`;
    await mutationsDelivered();
    stubNeverBounce();
    vi.advanceTimersByTime(NB_POLL_INTERVAL_MS);
    container.querySelector("form")!.append(document.createElement("span"));
    await mutationsDelivered();
    expect(registerListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(listener.destroy).toHaveBeenCalledTimes(1);
  });

  test("clears the tooltip on input in a type=email field with another name, not in other fields", async () => {
    stubNeverBounce();
    const container = mount();
    container.innerHTML = `<form><input type="email" name="contact"><input name="first"></form>`;
    await mutationsDelivered();
    const [email, first] = container.querySelectorAll("input");
    expect(registerListener).toHaveBeenCalledWith(email, false);
    showValidationMessage(email, "Bad address", "error");
    first.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.getElementById(NB_ERROR_ID)).not.toBeNull();
    email.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.getElementById(NB_ERROR_ID)).toBeNull();
  });
});
