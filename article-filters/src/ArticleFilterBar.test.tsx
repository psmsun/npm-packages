import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleFilterBar } from "./ArticleFilterBar.js";

const noop = () => {};

const render = (children?: ReactNode) =>
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
