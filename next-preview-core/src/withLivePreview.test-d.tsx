import type React from "react";
import { describe, expectTypeOf, it } from "vitest";
import { type LivePreviewOptions, type PreviewErrorOutput, type PreviewOutput, withLivePreview } from "./index";

type HomeProps = { locale: string; title?: string };
declare const HomeUI: React.ComponentType<HomeProps>;
declare function fetchHomepageContent(locale: string): Promise<{ title: string } | null>;

describe("withLivePreview types", () => {
  it("compiles the 1.0.16 three-argument call unchanged", () => {
    const PreviewHome = withLivePreview(
      HomeUI,
      ({ locale }) => fetchHomepageContent(locale),
      ({ locale }) => ["homepage", locale]
    );
    expectTypeOf(PreviewHome).toEqualTypeOf<(props: HomeProps) => React.JSX.Element>();
  });

  it("keeps the first three parameters and adds an optional fourth", () => {
    expectTypeOf(withLivePreview<HomeProps>).parameters.toEqualTypeOf<
      [
        WrappedComponent: React.ComponentType<HomeProps>,
        fetcherFn: (props: HomeProps) => Promise<any>,
        cacheKeyGenerator: (props: HomeProps) => any[],
        options?: LivePreviewOptions<HomeProps>,
      ]
    >();
    expectTypeOf<PreviewOutput<HomeProps>>().toEqualTypeOf<React.ReactNode | ((props: HomeProps) => React.ReactNode)>();
    expectTypeOf<PreviewErrorOutput<HomeProps>>().toEqualTypeOf<
      React.ReactNode | ((props: HomeProps, error: unknown) => React.ReactNode)
    >();
  });

  it("accepts every option form", () => {
    const texts: Record<string, string> = { en: "Loading preview...", zh: "正在加载预览…" };
    withLivePreview(HomeUI, ({ locale }) => fetchHomepageContent(locale), ({ locale }) => ["homepage", locale], {
      loading: ({ locale }) => texts[locale],
      notFound: <p>Not found</p>,
      error: (props, error) => (error instanceof Error ? error.message : props.locale),
    });
    withLivePreview(HomeUI, ({ locale }) => fetchHomepageContent(locale), ({ locale }) => ["homepage", locale], {
      loading: null,
      notFound: 404,
      error: "Preview failed to load.",
    });
  });

  it("rejects a wrong option key", () => {
    withLivePreview(HomeUI, ({ locale }) => fetchHomepageContent(locale), ({ locale }) => ["homepage", locale], {
      // @ts-expect-error notfound is not an option
      notfound: "Page not found!",
    });
  });

  it("types the props given to an option function", () => {
    withLivePreview(HomeUI, ({ locale }) => fetchHomepageContent(locale), ({ locale }) => ["homepage", locale], {
      // @ts-expect-error slug is not a prop of HomeUI
      loading: ({ slug }) => slug,
    });
  });
});
