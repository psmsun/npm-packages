"use client";

import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  clearValidationMessage,
  getRejectMessage,
  isAcceptable,
  isValidEmail,
  NB_POLL_INTERVAL_MS,
  NB_VERIFY_TIMEOUT_MS,
  type NeverBounceListener,
  type NeverBounceResponse,
  showValidationMessage,
} from "./form-utils.js";

/**
 * Wires NeverBounce email validation onto whatever ActiveCampaign form appears
 * inside `containerRef`.
 *
 * The AC form is injected by a remote script after render, so this watches for
 * it with a MutationObserver rather than assuming it exists. The NeverBounce
 * bundle loads `afterInteractive`, so the form can appear before `window._nb`
 * does — both are waited for independently.
 *
 * @param containerRef element wrapping the injected AC form markup
 * @param deps         re-run the wiring when these change (typically the form id)
 */
export function useNeverBounceEmailGate<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  deps: unknown[] = [],
): void {
  const nbListenerRef = useRef<NeverBounceListener | null>(null);
  const formInitializedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Initialize NeverBounce on ActiveCampaign forms
  const initializeNeverBounce = useCallback((form: HTMLFormElement) => {
    if (formInitializedRef.current) return;
    const emailInput = form.querySelector(
      'input[name="email"], input[type="email"], input[id="email"]',
    ) as HTMLInputElement | null;
    if (!emailInput || !window._nb) return;
    // Register email field with NeverBounce (false = don't show built-in blur feedback)
    nbListenerRef.current = window._nb.fields.registerListener(
      emailInput,
      false,
    );
    formInitializedRef.current = true;
    // Track if we're waiting for NeverBounce validation
    let isValidating = false;
    // Set while we re-fire a submission we previously held back
    let bypassValidation = false;
    // Polling timers, tracked so unmounting mid-check can't leave them running
    const timers = new Set<ReturnType<typeof setInterval>>();
    // Wait for the widget's verdict. Calls back with null if we gave up waiting.
    const waitForVerdict = (
      onVerdict: (response: NeverBounceResponse | null) => void,
    ) => {
      nbListenerRef.current?.forceUpdate();
      const startedAt = Date.now();
      const interval = setInterval(() => {
        const response = nbListenerRef.current?._response?.response;
        if (response) {
          clearInterval(interval);
          timers.delete(interval);
          onVerdict(response);
          return;
        }
        if (Date.now() - startedAt >= NB_VERIFY_TIMEOUT_MS) {
          clearInterval(interval);
          timers.delete(interval);
          onVerdict(null);
        }
      }, NB_POLL_INTERVAL_MS);
      timers.add(interval);
    };
    // Clear error when user starts typing - use event delegation on form for reliability
    const handleFormInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.getAttribute("name") === "email" || target.id === "email")
      ) {
        clearValidationMessage(emailInput);
      }
    };
    form.addEventListener("input", handleFormInput);
    // Show validation result on blur (when user leaves email field)
    const handleEmailBlur = () => {
      const emailValue = emailInput.value.trim();
      // Skip if empty or invalid format
      if (!emailValue) return;
      if (!isValidEmail(emailValue)) return;
      // If NeverBounce already has a response, show it
      const existing = nbListenerRef.current?._response?.response;
      if (existing) {
        if (!isAcceptable(existing)) {
          showValidationMessage(
            emailInput,
            getRejectMessage(existing),
            "error",
          );
        }
        return;
      }
      // No response yet - show pending and wait for result
      showValidationMessage(emailInput, "Verifying email...", "pending");
      waitForVerdict((response) => {
        if (response && !isAcceptable(response)) {
          showValidationMessage(
            emailInput,
            getRejectMessage(response),
            "error",
          );
        } else {
          clearValidationMessage(emailInput);
        }
      });
    };
    emailInput.addEventListener("blur", handleEmailBlur);
    // Re-fire a submission we held back, letting AC's own handler take it
    const resubmitForm = () => {
      bypassValidation = true;
      form.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    };
    // Intercept form submission using capture phase (runs before AC's handler)
    const handleSubmit = (e: Event) => {
      // Our own re-fire coming back around - we already made the call
      if (bypassValidation) {
        bypassValidation = false;
        return true;
      }
      const emailValue = emailInput.value.trim();
      // If email is empty, let AC handle its own required field validation
      if (!emailValue) {
        return true;
      }
      // Basic email format check - if invalid format, let AC handle it
      if (!isValidEmail(emailValue)) {
        return true;
      }
      // Check if NeverBounce has validated this email
      const response = nbListenerRef.current?._response?.response;
      if (response) {
        if (!isAcceptable(response)) {
          // Email is rejected - block submission
          e.preventDefault();
          e.stopPropagation();
          showValidationMessage(
            emailInput,
            getRejectMessage(response),
            "error",
          );
          return false;
        }
        // Email is acceptable - clear any messages and let AC handle the rest
        clearValidationMessage(emailInput);
        return true;
      }
      // No response yet - hold the submission until a verdict arrives
      e.preventDefault();
      e.stopPropagation();
      if (isValidating) return false;
      isValidating = true;
      showValidationMessage(
        emailInput,
        "Please wait, verifying email...",
        "pending",
      );
      waitForVerdict((verdict) => {
        isValidating = false;
        // Timing out fails open: holding back a real registrant costs this form
        // far more than letting one bounce through.
        if (!verdict || isAcceptable(verdict)) {
          clearValidationMessage(emailInput);
          resubmitForm();
          return;
        }
        showValidationMessage(emailInput, getRejectMessage(verdict), "error");
      });
      return false;
    };
    // Use capture: true to run BEFORE AC's handler
    form.addEventListener("submit", handleSubmit, true);
    // Cleanup function
    return () => {
      form.removeEventListener("submit", handleSubmit, true);
      form.removeEventListener("input", handleFormInput);
      emailInput.removeEventListener("blur", handleEmailBlur);
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
      clearValidationMessage(emailInput);
      nbListenerRef.current?.destroy();
      nbListenerRef.current = null;
      formInitializedRef.current = false;
    };
  }, []);

  // Watch for ActiveCampaign form to load
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let initStarted = false;
    let readyPoll: ReturnType<typeof setInterval> | undefined;
    // The NeverBounce bundle loads afterInteractive, so the AC form can show up
    // before `window._nb` exists. Wait for both instead of trying once and
    // silently giving up on the field.
    const initWhenReady = (form: HTMLFormElement) => {
      if (cancelled || initStarted) return;
      initStarted = true;
      if (window._nb) {
        cleanupRef.current = initializeNeverBounce(form) ?? null;
        return;
      }
      let attempts = 0;
      readyPoll = setInterval(() => {
        attempts += 1;
        if (cancelled || window._nb || attempts > 50) {
          clearInterval(readyPoll);
          if (!cancelled && window._nb) {
            cleanupRef.current = initializeNeverBounce(form) ?? null;
          }
        }
      }, NB_POLL_INTERVAL_MS);
    };
    // Check if form already exists
    const existingForm = containerRef.current.querySelector("form");
    if (existingForm) {
      initWhenReady(existingForm);
    }
    // Use MutationObserver to detect when AC form loads
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const form = containerRef.current?.querySelector("form");
          if (form && !initStarted) {
            initWhenReady(form);
            observer.disconnect();
            break;
          }
        }
      }
    });
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });
    return () => {
      cancelled = true;
      observer.disconnect();
      if (readyPoll) clearInterval(readyPoll);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, initializeNeverBounce, ...deps]);
}
