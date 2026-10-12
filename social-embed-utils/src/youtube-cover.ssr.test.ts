import { describe, expect, it } from "vitest";

describe("youtube-cover on the server", () => {
  it("runs without a DOM", () => {
    expect(typeof HTMLElement).toBe("undefined");
    expect(typeof customElements).toBe("undefined");
  });

  it("imports, and defineYoutubeCover is a no-op", async () => {
    const { defineYoutubeCover } = await import("./youtubeCover.js");
    expect(defineYoutubeCover()).toBeUndefined();
    expect(defineYoutubeCover("x-youtube-cover")).toBeUndefined();
  });
});
