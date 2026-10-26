// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, test } from "vitest";
import { type FormContentFlags, isWisentEmbed, useFormContentFlags } from "./useFormContentFlags.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OLD_HOST = `<div id="app"><script src="https://wisent-live-online.website.yandexcloud.net/app.js" data-registrationcode="874821"></script></div>`;
const NEW_HOST = `<div id="app"><script src="https://wisent-online.itegroup.online/app.js" data-apibaseurl="https://wisent-api.itegroup.online/api"></script></div>`;
const STORAGE_PDF = `<p><a href="https://storage.yandexcloud.net/x/file.pdf">PDF</a></p>`;
const ACTIVECAMPAIGN = `<div class="_form_1"></div><script src="https://ite681.activehosted.com/f/embed.php?id=1" type="text/javascript" charset="utf-8"></script>`;

function flagsAfterMount(html: string): FormContentFlags {
  let flags!: FormContentFlags;
  const Probe = () => {
    flags = useFormContentFlags(html);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() => root.render(createElement(Probe)));
  act(() => root.unmount());
  return flags;
}

describe("isWisentEmbed", () => {
  test.each([
    ["the old yandexcloud host", OLD_HOST],
    ["the new itegroup.online host", NEW_HOST],
  ])("finds the widget on %s", (_, html) => {
    expect(isWisentEmbed(html)).toBe(true);
  });

  test.each([
    ["a storage.yandexcloud.net link", STORAGE_PDF],
    ["an ActiveCampaign embed", ACTIVECAMPAIGN],
  ])("is false for %s", (_, html) => {
    expect(isWisentEmbed(html)).toBe(false);
  });
});

describe("useFormContentFlags", () => {
  test("flags the Wisent widget on the new host after mount", () => {
    expect(flagsAfterMount(NEW_HOST)).toEqual({ isYandexForm: true, isFormContent: false });
  });

  test("leaves a storage.yandexcloud.net link unflagged", () => {
    expect(flagsAfterMount(STORAGE_PDF)).toEqual({ isYandexForm: false, isFormContent: true });
  });
});
