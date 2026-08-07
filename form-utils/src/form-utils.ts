// Raw payload returned by NeverBounce's /v4/poe/check endpoint
export interface NeverBounceResponse {
  result: "valid" | "invalid" | "disposable" | "catchall" | "unknown";
  status: string;
  // Domain/mailbox evidence: has_dns, has_dns_mx, smtp_connectable, accepts_all,
  // free_email_host, role_account, disposable_email, spamtrap_network
  flags?: string[];
  // NeverBounce's own point-of-entry verdict, driven by the POE settings on the
  // account. Not read by the widget bundle, but it ships in every response.
  allow_entry?: boolean;
  suggested_correction?: string;
  execution_time?: number;
}

// NeverBounce listener interface for email validation
export interface NeverBounceListener {
  _response?: {
    response?: NeverBounceResponse;
  };
  _error?: boolean;
  _lastValue?: string;
  forceUpdate: () => void;
  destroy: () => void;
}

// NeverBounce widget injected on the window by the NeverBounce script
export interface NeverBounceWidget {
  fields: {
    registerListener: (
      input: HTMLInputElement,
      showBlurFeedback?: boolean,
    ) => NeverBounceListener;
  };
}

declare global {
  interface Window {
    _nb?: NeverBounceWidget;
  }
}

// How long to wait for a verdict before letting the submission through. The
// widget itself waits `_NBSettings.timeout * 1000 + 2500` (27.5s at the default
// timeout of 25), so anything shorter gives up while a check is still in flight.
// Greylisting hosts routinely take 11-13s to answer.
export const NB_VERIFY_TIMEOUT_MS = 30000;
export const NB_POLL_INTERVAL_MS = 200;

/**
 * Decide whether an address may proceed.
 *
 * Gates on evidence of a *bad* address rather than on `result` alone. A large
 * share of this audience is on hosts that greylist SMTP probes (rambler.ru and
 * many corporate Exchange servers), which returns `unknown` — an inconclusive
 * check, not a bad address. Rejecting those blocks real registrants, so when the
 * mailbox can't be confirmed we fall back to judging the domain.
 */
export function isAcceptable(response: NeverBounceResponse): boolean {
  const flags = response.flags ?? [];
  const has = (flag: string) => flags.includes(flag);

  if (has("disposable_email")) return false;
  if (response.result === "disposable") return false;
  if (response.result === "invalid") return false;
  if (response.result === "valid" || response.result === "catchall")
    return true;

  if (response.result === "unknown") {
    // Domain resolves, publishes MX and its mail server answers: deliverable in
    // all likelihood, the host just won't confirm individual mailboxes.
    if (has("has_dns_mx") && has("smtp_connectable")) return true;
    // No flags at all means the API gave up before gathering any evidence
    // (short timeout). Absence of evidence isn't grounds to reject.
    if (flags.length === 0) return true;
    // Otherwise require at least a mail exchanger — without MX there is no
    // mailbox to deliver to.
    return has("has_dns_mx");
  }

  return true;
}

// Email validation regex pattern
export const EMAIL_REGEX =
  /^[+_a-z0-9-'&=]+(\.[+_a-z0-9-']+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})$/i;

// Helper function to validate email format
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export const NB_ERROR_ID = "nb-email-validation-error";

export function getRejectMessage(response: NeverBounceResponse): string {
  const flags = response.flags ?? [];

  if (flags.includes("disposable_email") || response.result === "disposable") {
    return "Disposable email addresses are not accepted. Please use another address.";
  }

  // The API sometimes spots the typo for us — far more useful than a generic
  // rejection, since the usual cause is a mistyped domain.
  if (response.suggested_correction) {
    return `Did you mean ${response.suggested_correction}?`;
  }

  if (response.result === "invalid") {
    return "This email address doesn't appear to exist. Please check for typos.";
  }

  if (response.result === "unknown" && !flags.includes("has_dns_mx")) {
    return "This domain can't receive email. Please check the address.";
  }

  return "Please enter a valid email address.";
}

export function clearValidationMessage(input: HTMLInputElement) {
  // Remove error by ID from document (most reliable)
  const existingById = document.getElementById(NB_ERROR_ID);
  if (existingById) {
    existingById.remove();
  }
  input.classList.remove("_has_error");
}

function resizeTooltip(tooltip: HTMLElement, input: HTMLInputElement) {
  const rect = input.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollPosition = rect.top - scrollTop;
  if (scrollPosition < 40) {
    tooltip.className =
      tooltip.className.replace(/ ?(_above|_below) ?/g, "") + " _below";
  } else {
    tooltip.className =
      tooltip.className.replace(/ ?(_above|_below) ?/g, "") + " _above";
  }
}

export function showValidationMessage(
  input: HTMLInputElement,
  message: string,
  type: "error" | "pending",
) {
  // Always clear existing first
  clearValidationMessage(input);
  // Match ActiveCampaign's tooltip style exactly
  const tooltip = document.createElement("div");
  tooltip.className = "_error _above";
  tooltip.id = NB_ERROR_ID;
  tooltip.setAttribute("role", "alert");
  const arrow = document.createElement("div");
  arrow.className = "_error-arrow";
  const inner = document.createElement("div");
  inner.className = "_error-inner";
  if (type === "pending") {
    // Pending state - show loading style
    inner.style.cssText = `
      padding: 12px 12px 12px 36px;
      background-color: #FFF9E6;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23CA8A04' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 6v6l4 2'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: 12px center;
      font-size: 14px;
      font-family: arial, sans-serif;
      font-weight: 600;
      line-height: 16px;
      color: #000;
      border-radius: 4px;
      box-shadow: 0 1px 4px rgba(31, 33, 41, 0.3);
    `;
  } else {
    // Error state - match AC's error style
    inner.style.cssText = `
      padding: 12px 12px 12px 36px;
      background-color: #FFDDDD;
      background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM9 3V9H7V3H9ZM9 13V11H7V13H9Z' fill='%23CA0000'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: 12px center;
      font-size: 14px;
      font-family: arial, sans-serif;
      font-weight: 600;
      line-height: 16px;
      color: #000;
      border-radius: 4px;
      box-shadow: 0 1px 4px rgba(31, 33, 41, 0.3);
    `;
  }
  inner.textContent = message;
  tooltip.appendChild(arrow);
  tooltip.appendChild(inner);
  // Add error class to input for consistent styling
  if (type === "error") {
    input.classList.add("_has_error");
  }
  input.parentElement?.appendChild(tooltip);
  // Position tooltip (AC positions above by default)
  resizeTooltip(tooltip, input);
}
