/**
 * Pure derivation and filtering for article lists. No React, no DOM — every
 * function here is directly testable and shared by the MUI and shadcn bars.
 */

export type SortKey = "newest" | "oldest" | "title";

export interface SortOption {
  value: SortKey;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
];

export const DEFAULT_SORT: SortKey = "newest";

export interface TopicOption {
  slug: string;
  name: string;
  count: number;
}

/**
 * Field readers. The defaults match the fleet's dominant Strapi shape; a site
 * whose article type names things differently passes its own.
 */
export interface ArticleAccessors<T> {
  getId?: (article: T) => string | number | null | undefined;
  getTitle?: (article: T) => string | null | undefined;
  getDate?: (article: T) => string | null | undefined;
  getTags?: (
    article: T,
  ) => ReadonlyArray<{ Name?: string | null } | string> | null | undefined;
}

type ResolvedAccessors<T> = Required<ArticleAccessors<T>>;

export const defaultAccessors = <T,>(): ResolvedAccessors<T> => ({
  getId: (a) => (a as { id?: string | number }).id,
  getTitle: (a) => (a as { Title?: string }).Title,
  getDate: (a) => (a as { PublishedDate?: string }).PublishedDate,
  getTags: (a) => (a as { Tags?: { Name?: string | null }[] }).Tags,
});

export const resolveAccessors = <T,>(
  overrides?: ArticleAccessors<T>,
): ResolvedAccessors<T> => ({ ...defaultAccessors<T>(), ...overrides });

/**
 * Latin + Cyrillic; the fleet's tag names are one or the other. Explicit
 * ranges rather than \p{L} so the output is identical under every repo's
 * tsconfig target.
 */
export const slugifyTopic = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * PublishedDate is an ISO date or datetime ("2025-01-01" or
 * "2025-01-01T03:30:00.000Z"), so the first four characters are the (UTC)
 * year. Slicing beats new Date(), which would shift the year by the viewer's
 * timezone.
 */
export const articleYear = <T,>(
  article: T,
  accessors: ResolvedAccessors<T>,
): string => (accessors.getDate(article) ?? "").slice(0, 4);

const tagName = (tag: { Name?: string | null } | string): string =>
  typeof tag === "string" ? tag : (tag.Name ?? "");

export const articleTopicSlugs = <T,>(
  article: T,
  accessors: ResolvedAccessors<T>,
): string[] => {
  const tags = accessors.getTags(article) ?? [];
  return tags.map((tag) => slugifyTopic(tagName(tag))).filter(Boolean);
};

/**
 * Every distinct tag on the site, alphabetical. Alphabetical rather than
 * count-descending so the panel does not reshuffle when the year changes.
 * Two tags that slug identically merge; the first name wins.
 */
export const deriveTopicNames = <T,>(
  articles: readonly T[],
  accessors: ResolvedAccessors<T>,
): { slug: string; name: string }[] => {
  const bySlug = new Map<string, string>();
  for (const article of articles) {
    for (const tag of accessors.getTags(article) ?? []) {
      const name = tagName(tag).trim();
      const slug = slugifyTopic(name);
      if (slug && !bySlug.has(slug)) bySlug.set(slug, name);
    }
  }
  return [...bySlug.entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
};

export const deriveYears = <T,>(
  articles: readonly T[],
  accessors: ResolvedAccessors<T>,
): string[] => {
  const years = new Set<string>();
  for (const article of articles) {
    const year = articleYear(article, accessors);
    if (year) years.add(year);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
};

/**
 * Facet counts honour the year but ignore the topic selection, so ticking a
 * box never collapses the other counts to zero.
 */
export const deriveTopicOptions = <T,>(
  articles: readonly T[],
  topicNames: { slug: string; name: string }[],
  selectedYear: string,
  accessors: ResolvedAccessors<T>,
): TopicOption[] => {
  const counts = new Map<string, number>();
  for (const article of articles) {
    if (selectedYear && articleYear(article, accessors) !== selectedYear) {
      continue;
    }
    for (const slug of articleTopicSlugs(article, accessors)) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return topicNames.map((topic) => ({
    ...topic,
    count: counts.get(topic.slug) ?? 0,
  }));
};

/** Topics union (OR), year intersects (AND). */
export const filterArticles = <T,>(
  articles: readonly T[],
  selectedTopics: readonly string[],
  selectedYear: string,
  accessors: ResolvedAccessors<T>,
): T[] => {
  const topics = new Set(selectedTopics);
  return articles.filter((article) => {
    if (selectedYear && articleYear(article, accessors) !== selectedYear) {
      return false;
    }
    if (topics.size === 0) return true;
    return articleTopicSlugs(article, accessors).some((slug) =>
      topics.has(slug),
    );
  });
};

export const sortArticles = <T,>(
  articles: readonly T[],
  sort: SortKey,
  accessors: ResolvedAccessors<T>,
): T[] => {
  const sorted = [...articles];
  if (sort === "title") {
    sorted.sort((a, b) =>
      (accessors.getTitle(a) ?? "").localeCompare(
        accessors.getTitle(b) ?? "",
        undefined,
        { numeric: true, sensitivity: "base" },
      ),
    );
    return sorted;
  }
  const direction = sort === "oldest" ? -1 : 1;
  sorted.sort(
    (a, b) =>
      direction *
        (accessors.getDate(b) ?? "").localeCompare(accessors.getDate(a) ?? "") ||
      // Stable tie-break so same-day articles keep a fixed order.
      String(accessors.getId(a) ?? "").localeCompare(
        String(accessors.getId(b) ?? ""),
        undefined,
        { numeric: true },
      ),
  );
  return sorted;
};

export interface FilterState {
  topics: string[];
  year: string;
  sort: SortKey;
}

/** Values not present in the current data are dropped, not applied. */
export const parseFilterParams = (
  search: string,
  knownTopics: readonly string[],
  knownYears: readonly string[],
): Partial<FilterState> => {
  const params = new URLSearchParams(search);
  const state: Partial<FilterState> = {};

  const known = new Set(knownTopics);
  const topics = (params.get("topics") ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter((slug) => known.has(slug));
  if (topics.length > 0) state.topics = topics;

  const year = params.get("year") ?? "";
  if (knownYears.includes(year)) state.year = year;

  const sort = params.get("sort");
  if (SORT_OPTIONS.some((option) => option.value === sort)) {
    state.sort = sort as SortKey;
  }
  return state;
};

/** True when anything differs from the defaults — unlike isFiltered, sort counts. */
export const canResetFilters = (state: FilterState): boolean =>
  state.topics.length > 0 || state.year !== "" || state.sort !== DEFAULT_SORT;

/** Defaults write no param, so an unfiltered list keeps a clean URL. */
export const buildFilterSearch = (search: string, state: FilterState): string => {
  const params = new URLSearchParams(search);

  if (state.topics.length > 0) params.set("topics", state.topics.join(","));
  else params.delete("topics");

  if (state.year) params.set("year", state.year);
  else params.delete("year");

  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  else params.delete("sort");

  const query = params.toString();
  return query ? `?${query}` : "";
};
