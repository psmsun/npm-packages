
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";

/**
 * React Query provider for Preview Mode.
 * Part of @prismetic/next-preview-core.
 *
 * Wrap the preview build's component tree in this provider to enable
 * client-side caching of Strapi data. Layout data (Navbar, Footer)
 * fetched once will be served from the cache on subsequent page navigations.
 *
 * @param {number} [staleTime=300000] - How long (ms) cached data is considered fresh. Default: 5 minutes.
 * @param {boolean} [refetchOnWindowFocus=false] - Whether to refetch active queries when the browser tab becomes visible again.
 */
export function PreviewProviders({
  children,
  staleTime = 5 * 60 * 1000,
  refetchOnWindowFocus = false,
}: {
  children: React.ReactNode;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime,
            refetchOnWindowFocus,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ refetchType: "active" });
      }
    };

    // No window "focus" listener: a tab switch fires both events and fetched every active query twice.
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [queryClient, refetchOnWindowFocus]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
