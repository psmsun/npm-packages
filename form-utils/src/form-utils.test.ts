import { describe, expect, test } from "vitest";
import {
  getRejectMessage,
  isAcceptable,
  isValidEmail,
  type NeverBounceResponse,
} from "./form-utils.js";

const nb = (partial: Partial<NeverBounceResponse>): NeverBounceResponse => ({
  result: "valid",
  status: "success",
  ...partial,
});

describe("isAcceptable", () => {
  test("valid passes", () => {
    expect(isAcceptable(nb({ result: "valid" }))).toBe(true);
  });

  test("catchall passes", () => {
    expect(isAcceptable(nb({ result: "catchall" }))).toBe(true);
  });

  test("invalid is blocked", () => {
    expect(isAcceptable(nb({ result: "invalid" }))).toBe(false);
  });

  test("disposable is blocked", () => {
    expect(isAcceptable(nb({ result: "disposable" }))).toBe(false);
  });

  test("the disposable_email flag outranks a valid result", () => {
    expect(
      isAcceptable(nb({ result: "valid", flags: ["disposable_email"] })),
    ).toBe(false);
  });

  // The reason this package exists: probe-hostile corporate gateways greylist
  // NeverBounce's SMTP check and come back `unknown`. Blocking those blocks real
  // registrants (the original marketing@ite.group report).
  test("unknown with MX and a reachable mail server passes", () => {
    expect(
      isAcceptable(
        nb({
          result: "unknown",
          flags: ["has_dns", "has_dns_mx", "smtp_connectable"],
        }),
      ),
    ).toBe(true);
  });

  test("unknown with no flags at all passes — absence of evidence isn't evidence", () => {
    expect(isAcceptable(nb({ result: "unknown", flags: [] }))).toBe(true);
  });

  test("unknown with a missing flags field passes", () => {
    expect(isAcceptable(nb({ result: "unknown" }))).toBe(true);
  });

  test("unknown with MX but no SMTP connection still passes", () => {
    expect(
      isAcceptable(nb({ result: "unknown", flags: ["has_dns", "has_dns_mx"] })),
    ).toBe(true);
  });

  test("unknown on a domain with no mail exchanger is blocked", () => {
    expect(isAcceptable(nb({ result: "unknown", flags: ["has_dns"] }))).toBe(
      false,
    );
  });
});

describe("getRejectMessage", () => {
  test("disposable names the reason", () => {
    expect(getRejectMessage(nb({ result: "disposable" }))).toMatch(
      /Disposable email addresses/,
    );
  });

  test("the disposable_email flag wins over a suggested correction", () => {
    expect(
      getRejectMessage(
        nb({
          result: "invalid",
          flags: ["disposable_email"],
          suggested_correction: "user@gmail.com",
        }),
      ),
    ).toMatch(/Disposable email addresses/);
  });

  test("a suggested correction is offered verbatim", () => {
    expect(
      getRejectMessage(
        nb({ result: "invalid", suggested_correction: "user@gmail.com" }),
      ),
    ).toBe("Did you mean user@gmail.com?");
  });

  test("invalid points at typos", () => {
    expect(getRejectMessage(nb({ result: "invalid" }))).toMatch(
      /doesn't appear to exist/,
    );
  });

  test("unknown without MX blames the domain", () => {
    expect(
      getRejectMessage(nb({ result: "unknown", flags: ["has_dns"] })),
    ).toMatch(/domain can't receive email/);
  });

  test("anything else gets the generic message", () => {
    expect(getRejectMessage(nb({ result: "catchall" }))).toBe(
      "Please enter a valid email address.",
    );
  });
});

describe("isValidEmail", () => {
  test.each([
    "user@example.com",
    "first.last@sub.example.co.uk",
    "user+tag@example.com",
    "o'brien@example.com",
  ])("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  test.each([
    "",
    "user",
    "user@",
    "@example.com",
    "user@example",
    "user @example.com",
  ])("rejects %s", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
