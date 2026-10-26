import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArticleFilterBar } from "./ArticleFilterBar.js";

// A closed Radix panel renders nothing, so put its content inline.
vi.mock("@radix-ui/react-popover", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@radix-ui/react-popover")>()),
  Portal: ({ children }: { children: ReactNode }) => children,
  Content: ({ children }: { children: ReactNode }) => children,
}));

const noop = () => {};

describe("ArticleFilterBar sortOptions fallback", () => {
  it("lists every default sort option when given an empty array", () => {
    const html = renderToStaticMarkup(
      <ArticleFilterBar
        topicOptions={[]}
        yearOptions={[]}
        selectedTopics={[]}
        selectedYear=""
        sort="newest"
        sortOptions={[]}
        onToggleTopic={noop}
        onClearTopics={noop}
        onYearChange={noop}
        onSortChange={noop}
      />,
    );
    expect(html).toContain('role="listbox"');
    for (const label of ["Newest first", "Oldest first", "Title A–Z"]) {
      expect(html).toContain(label);
    }
  });
});
