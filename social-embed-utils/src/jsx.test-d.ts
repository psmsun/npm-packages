import type { JSX } from "react";
import { describe, expectTypeOf, it } from "vitest";
import type {} from "./jsx.js";

type YoutubeCoverProps = JSX.IntrinsicElements["youtube-cover"];

describe("JSX.IntrinsicElements['youtube-cover']", () => {
  it("types url and label as optional strings", () => {
    expectTypeOf<YoutubeCoverProps["url"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<YoutubeCoverProps["label"]>().toEqualTypeOf<string | undefined>();
  });

  it("types cover as an optional string", () => {
    expectTypeOf<YoutubeCoverProps["cover"]>().toEqualTypeOf<string | undefined>();
    // @ts-expect-error cover is a string attribute
    const props: YoutubeCoverProps = { cover: { url: "https://cdn.itegroupnews.com/KIHE_7100e96610.png" } };
    expectTypeOf(props).toEqualTypeOf<YoutubeCoverProps>();
  });

  it("accepts className and the other HTML attributes", () => {
    expectTypeOf<YoutubeCoverProps["className"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<{ url: string; label: string; cover: string; className: string; hidden: boolean }>().toExtend<YoutubeCoverProps>();
  });

  it("rejects a url that is not a string", () => {
    // @ts-expect-error url is a string attribute
    const props: YoutubeCoverProps = { url: 42 };
    expectTypeOf(props).toEqualTypeOf<YoutubeCoverProps>();
  });
});
