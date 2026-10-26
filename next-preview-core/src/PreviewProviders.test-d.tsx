import { describe, it } from "vitest";
import { PreviewProviders } from "./index";

describe("PreviewProviders types", () => {
  it("accepts staleTime and rejects the removed refetchOnWindowFocus prop", () => {
    <PreviewProviders staleTime={0}>{null}</PreviewProviders>;
    <PreviewProviders
      // @ts-expect-error refetchOnWindowFocus was removed in 2.0
      refetchOnWindowFocus
    >
      {null}
    </PreviewProviders>;
  });
});
