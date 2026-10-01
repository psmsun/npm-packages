"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ArticleAccessors,
  buildFilterSearch,
  canResetFilters,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  derivePageSizeOptions,
  deriveTopicNames,
  deriveTopicOptions,
  deriveYears,
  filterArticles,
  limitArticles,
  type PageSize,
  parseFilterParams,
  resolveAccessors,
  type SortKey,
  sortArticles,
  type TopicOption,
} from "./filters.js";

export interface UseArticleFiltersOptions<T> extends ArticleAccessors<T> {
  /**
   * Sync state to the query string via history.replaceState. Static exports
   * have no server to hand a new URL to, and pushing entries would make Back
   * walk the filter history instead of leaving the page.
   */
  syncUrl?: boolean;
}

export interface UseArticleFiltersResult<T> {
  /** Filtered and sorted. */
  articles: T[];
  /** `articles` cut to `pageSize` — render this on sites that use the Show select. */
  visibleArticles: T[];
  topicOptions: TopicOption[];
  yearOptions: string[];
  selectedTopics: string[];
  selectedYear: string;
  sort: SortKey;
  pageSize: PageSize;
  /** From the unfiltered total; empty when the list fits in one page. */
  pageSizeOptions: PageSize[];
  setTopics: (slugs: string[]) => void;
  toggleTopic: (slug: string) => void;
  clearTopics: () => void;
  setYear: (year: string) => void;
  setSort: (sort: SortKey) => void;
  setPageSize: (size: PageSize) => void;
  resetAll: () => void;
  isFiltered: boolean;
  /** True when anything differs from the defaults, sort included — drives a Reset button. */
  canReset: boolean;
  /** Changes whenever the result set changes; use it to reset pagination. */
  signature: string;
}

export default function useArticleFilters<T>(
  source: readonly T[],
  options: UseArticleFiltersOptions<T> = {},
): UseArticleFiltersResult<T> {
  const { syncUrl = true, ...accessorOverrides } = options;

  // Accessors are plain functions a caller will usually define inline, so
  // holding the first set keeps them from re-running every derivation.
  const accessorsRef = useRef(resolveAccessors<T>(accessorOverrides));
  const accessors = accessorsRef.current;

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);

  const topicNames = useMemo(
    () => deriveTopicNames(source, accessors),
    [source, accessors],
  );

  const yearOptions = useMemo(
    () => deriveYears(source, accessors),
    [source, accessors],
  );

  const topicOptions = useMemo(
    () => deriveTopicOptions(source, topicNames, selectedYear, accessors),
    [source, topicNames, selectedYear, accessors],
  );

  const pageSizeOptions = useMemo(
    () => derivePageSizeOptions(source.length),
    [source.length],
  );

  // Read the shared link once mounted. Applying it during render would make
  // the first client paint diverge from the statically exported HTML.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!syncUrl || hydratedRef.current) return;
    hydratedRef.current = true;

    const parsed = parseFilterParams(
      window.location.search,
      topicNames.map((topic) => topic.slug),
      yearOptions,
      pageSizeOptions,
    );
    if (parsed.topics) setSelectedTopics(parsed.topics);
    if (parsed.year) setSelectedYear(parsed.year);
    if (parsed.sort) setSort(parsed.sort);
    if (parsed.pageSize !== undefined) setPageSize(parsed.pageSize);
  }, [syncUrl, topicNames, yearOptions, pageSizeOptions]);

  useEffect(() => {
    // Writing before the URL has been read would erase the incoming link.
    if (!syncUrl || !hydratedRef.current) return;

    const search = buildFilterSearch(window.location.search, {
      topics: selectedTopics,
      year: selectedYear,
      sort,
      pageSize,
    });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }, [syncUrl, selectedTopics, selectedYear, sort, pageSize]);

  const articles = useMemo(
    () =>
      sortArticles(
        filterArticles(source, selectedTopics, selectedYear, accessors),
        sort,
        accessors,
      ),
    [source, selectedTopics, selectedYear, sort, accessors],
  );

  const visibleArticles = useMemo(
    () => limitArticles(articles, pageSize),
    [articles, pageSize],
  );

  const toggleTopic = useCallback((slug: string) => {
    setSelectedTopics((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
    );
  }, []);

  const clearTopics = useCallback(() => setSelectedTopics([]), []);

  const resetAll = useCallback(() => {
    setSelectedTopics([]);
    setSelectedYear("");
    setSort(DEFAULT_SORT);
    setPageSize(DEFAULT_PAGE_SIZE);
  }, []);

  return {
    articles,
    visibleArticles,
    topicOptions,
    yearOptions,
    selectedTopics,
    selectedYear,
    sort,
    pageSize,
    pageSizeOptions,
    setTopics: setSelectedTopics,
    toggleTopic,
    clearTopics,
    setYear: setSelectedYear,
    setSort,
    setPageSize,
    resetAll,
    isFiltered: selectedTopics.length > 0 || selectedYear !== "",
    canReset: canResetFilters({
      topics: selectedTopics,
      year: selectedYear,
      sort,
      pageSize,
    }),
    signature: `${selectedTopics.join(",")}|${selectedYear}|${sort}`,
  };
}
