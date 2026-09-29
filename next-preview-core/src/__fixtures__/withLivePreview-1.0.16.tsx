"use client";

import { useQuery } from "@tanstack/react-query";
import React from "react";

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
  cacheKeyGenerator: (props: P) => any[]
) {
  return function PreviewComponent(props: P) {
    const queryKey = cacheKeyGenerator(props);

    const { data, isLoading } = useQuery({
      queryKey,
      queryFn: () => fetcherFn(props),
    });

    if (isLoading) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Loading preview...
        </div>
      );
    }

    if (!data) {
      return (
        <div
          style={{
            height: "50vh",
            background: "white",
            zIndex: 10000,
            width: "100%",
            display: "grid",
            placeContent: "center",
            fontSize: "36px",
          }}
        >
          Page not found!
        </div>
      );
    }

    // Props spread first, then fetched data takes priority
    return <WrappedComponent {...props} {...data} />;
  };
}
