import { describe, expect, it } from "vitest";
import {
  buildFilterSearch,
  deriveTopicNames,
  deriveTopicOptions,
  deriveYears,
  filterArticles,
  parseFilterParams,
  resolveAccessors,
  slugifyTopic,
  sortArticles,
} from "./filters.js";

interface A {
  id: string;
  Title: string;
  PublishedDate: string;
  Tags: { Name: string }[] | null;
}

const acc = resolveAccessors<A>();

const make = (
  id: string,
  Title: string,
  PublishedDate: string,
  tags: string[] = [],
): A => ({ id, Title, PublishedDate, Tags: tags.map((Name) => ({ Name })) });

describe("slugifyTopic", () => {
  it("trims the CMS's trailing-space tag names", () => {
    expect(slugifyTopic("Grocery ")).toBe("grocery");
  });

  it("collapses punctuation and ampersands", () => {
    expect(slugifyTopic("Tea, Coffee & Cacao")).toBe("tea-coffee-cacao");
    expect(slugifyTopic("Oil & Fats")).toBe("oil-fats");
  });

  it("keeps Cyrillic for the ru sites", () => {
    expect(slugifyTopic("Молочная продукция")).toBe("молочная-продукция");
  });

  it("returns empty for a name with nothing sluggable", () => {
    expect(slugifyTopic("  —  ")).toBe("");
  });
});

describe("deriveTopicNames", () => {
  it("is alphabetical, so the panel does not reshuffle on a year change", () => {
    const articles = [
      make("1", "a", "2025-01-01", ["Seafood", "Baking"]),
      make("2", "b", "2024-01-01", ["Cheese"]),
    ];
    expect(deriveTopicNames(articles, acc).map((t) => t.name)).toEqual([
      "Baking",
      "Cheese",
      "Seafood",
    ]);
  });

  it("merges names that slug identically, first name winning", () => {
    const articles = [make("1", "a", "2025-01-01", ["Grocery ", "Grocery"])];
    expect(deriveTopicNames(articles, acc)).toEqual([
      { slug: "grocery", name: "Grocery" },
    ]);
  });

  it("ignores articles with no tags", () => {
    const articles = [{ ...make("1", "a", "2025-01-01"), Tags: null }];
    expect(deriveTopicNames(articles, acc)).toEqual([]);
  });
});

describe("deriveYears", () => {
  it("is newest first and deduplicated", () => {
    const articles = [
      make("1", "a", "2024-05-01"),
      make("2", "b", "2026-01-01"),
      make("3", "c", "2024-11-01"),
    ];
    expect(deriveYears(articles, acc)).toEqual(["2026", "2024"]);
  });

  it("reads the year off the string, not through Date", () => {
    // new Date("2026-01-01").getFullYear() is 2025 west of UTC.
    expect(deriveYears([make("1", "a", "2026-01-01")], acc)).toEqual(["2026"]);
  });
});

describe("deriveTopicOptions", () => {
  const articles = [
    make("1", "a", "2026-01-01", ["Dairy"]),
    make("2", "b", "2025-01-01", ["Dairy", "Cheese"]),
    make("3", "c", "2025-01-01", ["Cheese"]),
  ];
  const names = deriveTopicNames(articles, acc);

  it("counts the whole corpus when no year is selected", () => {
    const counts = deriveTopicOptions(articles, names, "", acc);
    expect(counts).toEqual([
      { slug: "cheese", name: "Cheese", count: 2 },
      { slug: "dairy", name: "Dairy", count: 2 },
    ]);
  });

  it("narrows counts to the selected year", () => {
    const counts = deriveTopicOptions(articles, names, "2026", acc);
    expect(counts.map((c) => c.count)).toEqual([0, 1]);
  });

  it("keeps every topic listed even at zero, so the list is stable", () => {
    expect(deriveTopicOptions(articles, names, "2026", acc)).toHaveLength(2);
  });
});

describe("filterArticles", () => {
  const articles = [
    make("1", "a", "2026-01-01", ["Dairy"]),
    make("2", "b", "2025-01-01", ["Cheese"]),
    make("3", "c", "2025-01-01", []),
  ];

  it("returns everything when nothing is selected", () => {
    expect(filterArticles(articles, [], "", acc)).toHaveLength(3);
  });

  it("unions multiple topics rather than intersecting them", () => {
    const out = filterArticles(articles, ["dairy", "cheese"], "", acc);
    expect(out.map((a) => a.id)).toEqual(["1", "2"]);
  });

  it("intersects the year with the topics", () => {
    const out = filterArticles(articles, ["dairy", "cheese"], "2025", acc);
    expect(out.map((a) => a.id)).toEqual(["2"]);
  });

  it("drops untagged articles once a topic is chosen", () => {
    expect(filterArticles(articles, ["dairy"], "", acc).map((a) => a.id)).toEqual(
      ["1"],
    );
  });
});

describe("sortArticles", () => {
  const articles = [
    make("10", "Zebra", "2026-07-27"),
    make("2", "apple", "2026-07-27"),
    make("7", "Mango", "2024-01-01"),
  ];

  it("puts the newest first and breaks same-day ties stably", () => {
    expect(sortArticles(articles, "newest", acc).map((a) => a.id)).toEqual([
      "2",
      "10",
      "7",
    ]);
  });

  it("reverses for oldest while keeping the same tie order", () => {
    expect(sortArticles(articles, "oldest", acc).map((a) => a.id)).toEqual([
      "7",
      "2",
      "10",
    ]);
  });

  it("sorts titles case-insensitively", () => {
    expect(sortArticles(articles, "title", acc).map((a) => a.Title)).toEqual([
      "apple",
      "Mango",
      "Zebra",
    ]);
  });

  it("does not mutate its input", () => {
    const before = articles.map((a) => a.id);
    sortArticles(articles, "title", acc);
    expect(articles.map((a) => a.id)).toEqual(before);
  });
});

describe("parseFilterParams", () => {
  const topics = ["dairy", "cheese"];
  const years = ["2026", "2025"];

  it("keeps only topics that still exist", () => {
    const out = parseFilterParams("?topics=dairy,gone", topics, years);
    expect(out.topics).toEqual(["dairy"]);
  });

  it("drops a year with no articles", () => {
    expect(parseFilterParams("?year=1999", topics, years).year).toBeUndefined();
  });

  it("drops an unknown sort rather than applying it", () => {
    expect(parseFilterParams("?sort=bogus", topics, years).sort).toBeUndefined();
    expect(parseFilterParams("?sort=title", topics, years).sort).toBe("title");
  });

  it("returns nothing for a bare URL", () => {
    expect(parseFilterParams("", topics, years)).toEqual({});
  });
});

describe("buildFilterSearch", () => {
  it("writes no params at the defaults", () => {
    expect(
      buildFilterSearch("", { topics: [], year: "", sort: "newest" }),
    ).toBe("");
  });

  it("writes each active filter", () => {
    expect(
      buildFilterSearch("", {
        topics: ["dairy", "cheese"],
        year: "2025",
        sort: "oldest",
      }),
    ).toBe("?topics=dairy%2Ccheese&year=2025&sort=oldest");
  });

  it("preserves unrelated params such as utm tags", () => {
    const out = buildFilterSearch("?utm_source=x", {
      topics: ["dairy"],
      year: "",
      sort: "newest",
    });
    expect(out).toContain("utm_source=x");
    expect(out).toContain("topics=dairy");
  });

  it("clears a param when its filter is reset", () => {
    expect(
      buildFilterSearch("?topics=dairy&year=2025", {
        topics: [],
        year: "",
        sort: "newest",
      }),
    ).toBe("");
  });
});
