"use client";

import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useRef } from "react";

export type PreviewOutput<P> = React.ReactNode | ((props: P) => React.ReactNode);
export type PreviewErrorOutput<P> = React.ReactNode | ((props: P, error: unknown) => React.ReactNode);

export interface LivePreviewOptions<P> {
  loading?: PreviewOutput<P>;
  notFound?: PreviewOutput<P>;
  error?: PreviewErrorOutput<P>;
}

const loadingStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const notFoundStyle: React.CSSProperties = {
  height: "50vh",
  background: "white",
  zIndex: 10000,
  width: "100%",
  display: "grid",
  placeContent: "center",
  fontSize: "36px",
};

const notLogged = Symbol();

function resolveOutput<A extends unknown[]>(
  option: React.ReactNode | ((...args: A) => React.ReactNode),
  fallback: string,
  ...args: A
): React.ReactNode {
  if (option === undefined) return fallback;
  return typeof option === "function" ? option(...args) : option;
}

function block(content: React.ReactNode, style: React.CSSProperties, extra?: React.ReactNode) {
  if (typeof content === "string" || typeof content === "number") {
    return (
      <div style={style}>
        {content}
        {extra}
      </div>
    );
  }
  return <>{content}</>;
}

/**
 * A generic Higher-Order Component for Preview Mode data fetching.
 * Part of @prismetic/next-preview-core.
 *
 * @param {React.Component} WrappedComponent - The pure UI component to render once data is fetched.
 * @param {Function} fetcherFn - An async function that fetches data (receives component props as argument).
 * @param {Function} cacheKeyGenerator - A function that returns a React Query queryKey array (receives component props).
 *
 * @example
 * // In your project's preview wrapper:
 * import { withLivePreview } from "@prismetic/next-preview-core";
 * import HomeUI from "../HomeUI";
 * import { fetchHomepageContent } from "@/api/queryModules";
 *
 * export const PreviewHome = withLivePreview(
 *   HomeUI,
 *   ({ locale }) => fetchHomepageContent(locale),
 *   ({ locale }) => ["homepage", locale]
 * );
 */
export function withLivePreview<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fetcherFn: (props: P) => Promise<any>,
  cacheKeyGenerator: (props: P) => any[],
  options?: LivePreviewOptions<P>
) {
  return function PreviewComponent(props: P) {
    const queryKey = cacheKeyGenerator(props);

    const { data, isLoading, isError, error } = useQuery({
      queryKey,
      queryFn: async () => (await fetcherFn(props)) ?? null,
    });

    const logged = useRef<unknown>(notLogged);
    useEffect(() => {
      if (isError && logged.current !== error) {
        logged.current = error;
        console.error("[preview] Fetch failed", queryKey, error);
      }
    }, [isError, error]);

    if (isLoading) {
      return block(resolveOutput(options?.loading, "Loading preview...", props), loadingStyle);
    }

    if (data) {
      // Props spread first, then fetched data takes priority
      return <WrappedComponent {...props} {...data} />;
    }

    if (isError) {
      const message =
        error instanceof Error && error.message.trim() ? (
          <div style={{ fontSize: "16px" }}>{error.message}</div>
        ) : null;
      return block(resolveOutput(options?.error, "Preview failed to load.", props, error), notFoundStyle, message);
    }

    return block(resolveOutput(options?.notFound, "Page not found!", props), notFoundStyle);
  };
}
