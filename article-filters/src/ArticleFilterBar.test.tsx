import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleFilterBar, type ArticleFilterBarProps } from "./ArticleFilterBar.js";
import type { PageSize } from "./filters.js";

const noop = () => {};
const sizes: PageSize[] = [30, 60, "all"];

const render = (children?: ReactNode, props?: Partial<ArticleFilterBarProps>) =>
  renderToStaticMarkup(
    <ArticleFilterBar
      topicOptions={[]}
      yearOptions={["2026", "2025"]}
      selectedTopics={[]}
      selectedYear=""
      sort="newest"
      onToggleTopic={noop}
      onClearTopics={noop}
      onYearChange={noop}
      onSortChange={noop}
      {...props}
    >
      {children}
    </ArticleFilterBar>,
  );

describe("ArticleFilterBar children slot", () => {
  it("renders the slot last in the row, after Sort", () => {
    const html = render(<button type="button" id="reset">Reset filters</button>);
    expect(html).toContain('id="reset"');
    expect(html.indexOf("Newest first")).toBeLessThan(html.indexOf('id="reset"'));
    expect(html.endsWith('Reset filters</button></div>')).toBe(true);
  });

  it("renders nothing extra without children", () => {
    expect(render()).not.toContain("Reset filters");
  });
});

describe("ArticleFilterBar Show select", () => {
  const show = (props: Partial<ArticleFilterBarProps>, children?: ReactNode) =>
    render(children, { pageSizeOptions: sizes, onPageSizeChange: noop, ...props });

  it("renders after Sort and before the children slot", () => {
    const html = show({}, <button type="button" id="reset">Reset filters</button>);
    expect(html).toContain("Show 30");
    expect(html).toContain("Number of articles shown");
    expect(html).toContain("article-filter-bar__control--show");
    expect(html.indexOf("Newest first")).toBeLessThan(html.indexOf("Show 30"));
    expect(html.indexOf("Show 30")).toBeLessThan(html.indexOf('id="reset"'));
  });

  // The panel is closed in static markup, so labels are read off the trigger.
  it("labels the trigger with the selected size", () => {
    expect(show({ pageSize: 60 })).toContain("Show 60");
    expect(show({ pageSize: "all" })).toContain("Show all");
  });

  it("is hidden without onPageSizeChange", () => {
    expect(show({ onPageSizeChange: undefined })).not.toContain("Show 30");
  });

  it("is hidden with fewer than two options", () => {
    expect(show({ pageSizeOptions: [] })).not.toContain("Show 30");
    expect(show({ pageSizeOptions: [30] })).not.toContain("Show 30");
  });

  it("takes site wording through labels", () => {
    const labels = { showCount: (n: number) => `Zeige ${n}`, showAll: "Alle" };
    expect(show({ labels })).toContain("Zeige 30");
    expect(show({ labels })).not.toContain("Show 30");
    expect(show({ labels, pageSize: "all" })).toContain("Alle");
  });
});
