import type { JSX } from "react";
import { describe, expectTypeOf, it } from "vitest";
import type {} from "./jsx.js";

type YoutubeCoverProps = JSX.IntrinsicElements["youtube-cover"];

describe("JSX.IntrinsicElements['youtube-cover']", () => {
  it("types url and label as optional strings", () => {
    expectTypeOf<YoutubeCoverProps["url"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<YoutubeCoverProps["label"]>().toEqualTypeOf<string | undefined>();
  });

  it("accepts className and the other HTML attributes", () => {
    expectTypeOf<YoutubeCoverProps["className"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<{ url: string; label: string; className: string; hidden: boolean }>().toExtend<YoutubeCoverProps>();
  });

  it("rejects a url that is not a string", () => {
    // @ts-expect-error url is a string attribute
    const props: YoutubeCoverProps = { url: 42 };
    expectTypeOf(props).toEqualTypeOf<YoutubeCoverProps>();
  });
});
