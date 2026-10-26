
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * React Query provider for Preview Mode.
 * Part of @prismetic/next-preview-core.
 *
 * Wrap the preview build's component tree in this provider to enable
 * client-side caching of Strapi data. Layout data (Navbar, Footer)
 * fetched once will be served from the cache on subsequent page navigations.
 *
 * @param {number} [staleTime=300000] - How long (ms) cached data is considered fresh. Default: 5 minutes.
 */
export function PreviewProviders({
  children,
  staleTime = 5 * 60 * 1000,
}: {
  children: React.ReactNode;
  staleTime?: number;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime,
            // Preview never refetches on tab focus; content refreshes on navigation or reload.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
