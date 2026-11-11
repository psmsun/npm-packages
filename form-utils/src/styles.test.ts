// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const STYLES = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../styles.css"), "utf8");

const HIDDEN_UTM_QUESTIONS = [
  "628b4eee1cca9b0b10953e1b",
  "628b4f031cca9b0b10953e1d",
  "628b4f121cca9b0b10953e1e",
  "628b4f2c1cca9b0b10953e24",
  "628b4f3b1cca9b0b10953e28",
];

function renderGroup(groupClassName: string): HTMLElement {
  document.body.innerHTML = `<div class="container-registration"><div id="ite_vr"><div><div data-ref="x"><div class="form-group ${groupClassName}"><label>utm</label><input type="text"></div></div></div></div></div>`;
  return document.querySelector<HTMLElement>(".form-group")!;
}

describe("styles.css hidden questions", () => {
  beforeEach(() => {
    const style = document.createElement("style");
    style.textContent = STYLES;
    document.head.appendChild(style);
  });

  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it.each(HIDDEN_UTM_QUESTIONS)("hides the q_%s group", (id) => {
    expect(getComputedStyle(renderGroup(`q_${id}`)).display).toBe("none");
  });

  it("leaves any other question visible", () => {
    expect(getComputedStyle(renderGroup("q_628b4e2e1cca9b0b10953e00")).display).toBe("block");
  });

  it("leaves a question visible once the widget swaps q_<id> for has-error", () => {
    expect(getComputedStyle(renderGroup("has-error")).display).toBe("block");
  });

  it("needs the widget's #ite_vr root", () => {
    document.body.innerHTML = `<div class="container-registration"><div class="form-group q_${HIDDEN_UTM_QUESTIONS[0]}"></div></div>`;
    expect(getComputedStyle(document.querySelector(".form-group")!).display).toBe("block");
  });
});
