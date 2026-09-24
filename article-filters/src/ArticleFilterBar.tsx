"use client";

import * as Checkbox from "@radix-ui/react-checkbox";
import * as Popover from "@radix-ui/react-popover";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { SORT_OPTIONS, type SortKey, type TopicOption } from "./filters.js";

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/**
 * Every slot takes a class. Defaults live in styles.css as plain CSS, so
 * Tailwind never has to scan this package — a site's overrides are Tailwind
 * utilities written in its own source, where its scanner already looks.
 */
export interface ArticleFilterBarClassNames {
  root?: string;
  control?: string;
  trigger?: string;
  triggerLabel?: string;
  triggerIcon?: string;
  panel?: string;
  option?: string;
  optionLabel?: string;
  count?: string;
  checkbox?: string;
  clear?: string;
}

export interface ArticleFilterBarLabels {
  allTopics?: string;
  allYears?: string;
  clear?: string;
  /** Receives the count when more than one topic is selected. */
  topicsSelected?: (count: number) => string;
  topicsAriaLabel?: string;
  yearsAriaLabel?: string;
  sortAriaLabel?: string;
}

const DEFAULT_LABELS: Required<ArticleFilterBarLabels> = {
  allTopics: "All topics",
  allYears: "All years",
  clear: "Clear",
  topicsSelected: (count) => `${count} topics`,
  topicsAriaLabel: "Filter articles by topic",
  yearsAriaLabel: "Filter articles by year",
  sortAriaLabel: "Sort articles",
};

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg
    className={cx("article-filter-bar__icon", className)}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 13l4 4L19 7"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Roving arrow-key navigation across the options inside an open panel. */
const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;

  const options = [
    ...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'),
  ];
  if (options.length === 0) return;

  const current = options.indexOf(document.activeElement as HTMLElement);
  let next = current;
  if (event.key === "ArrowDown") next = current + 1;
  if (event.key === "ArrowUp") next = current - 1;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = options.length - 1;

  const clamped = Math.max(0, Math.min(options.length - 1, next));
  if (clamped === current) return;
  event.preventDefault();
  options[clamped].focus();
};

interface FilterControlProps {
  label: string;
  ariaLabel: string;
  classNames?: ArticleFilterBarClassNames;
  children: ReactNode;
}

const FilterControl = ({
  label,
  ariaLabel,
  classNames,
  children,
}: FilterControlProps) => {
  const [open, setOpen] = useState(false);
  const labelId = useId();

  return (
    <div className={cx("article-filter-bar__control", classNames?.control)}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          className={cx("article-filter-bar__trigger", classNames?.trigger)}
          aria-label={ariaLabel}
          id={labelId}
        >
          <span
            className={cx(
              "article-filter-bar__trigger-label",
              classNames?.triggerLabel,
            )}
          >
            {label}
          </span>
          <ChevronIcon className={classNames?.triggerIcon} />
        </Popover.Trigger>
        <Popover.Portal>
          {/*
            Non-modal on purpose: Radix's modal scroll lock compensates for a
            scrollbar it removes from <body>, but these sites scroll on <html>,
            so the compensation lands as a width change and shifts the centred
            container sideways when the panel opens.
          */}
          <Popover.Content
            align="start"
            sideOffset={4}
            className={cx("article-filter-bar__panel", classNames?.panel)}
            onOpenAutoFocus={(event) => event.preventDefault()}
            // ScrollSmoother moves the trigger by transform after scroll events stop, which "optimized" misses.
            updatePositionStrategy="always"
          >
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled below */}
            <div
              role="listbox"
              aria-labelledby={labelId}
              onKeyDown={handleListKeyDown}
            >
              {children}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};

export interface ArticleFilterBarProps {
  topicOptions: TopicOption[];
  yearOptions: string[];
  selectedTopics: string[];
  selectedYear: string;
  sort: SortKey;
  onToggleTopic: (slug: string) => void;
  onClearTopics: () => void;
  onYearChange: (year: string) => void;
  onSortChange: (sort: SortKey) => void;
  classNames?: ArticleFilterBarClassNames;
  labels?: ArticleFilterBarLabels;
  /** Sort options with site-specific wording, e.g. a translated set. */
  sortOptions?: { value: SortKey; label: string }[];
  /** Rendered last in the row, after Sort — e.g. the site's own Reset button. */
  children?: ReactNode;
}

export const ArticleFilterBar = ({
  topicOptions,
  yearOptions,
  selectedTopics,
  selectedYear,
  sort,
  onToggleTopic,
  onClearTopics,
  onYearChange,
  onSortChange,
  classNames,
  labels,
  sortOptions = SORT_OPTIONS,
  children,
}: ArticleFilterBarProps) => {
  const text = { ...DEFAULT_LABELS, ...labels };

  // A control with nothing to choose between is hidden rather than shown
  // empty, so a site whose Tags relation is unpopulated just gets year + sort.
  const showTopics = topicOptions.length > 1;
  const showYears = yearOptions.length > 1;

  const topicsLabel = (() => {
    if (selectedTopics.length === 0) return text.allTopics;
    if (selectedTopics.length === 1) {
      const selected = topicOptions.find(
        (topic) => topic.slug === selectedTopics[0],
      );
      return selected ? selected.name : text.topicsSelected(1);
    }
    return text.topicsSelected(selectedTopics.length);
  })();

  const optionClass = cx("article-filter-bar__option", classNames?.option);

  return (
    <div className={cx("article-filter-bar", classNames?.root)}>
      {showTopics && (
        <FilterControl
          label={topicsLabel}
          ariaLabel={text.topicsAriaLabel}
          classNames={classNames}
        >
          {topicOptions.map((topic) => {
            const checked = selectedTopics.includes(topic.slug);
            return (
              <button
                type="button"
                key={topic.slug}
                role="option"
                aria-selected={checked}
                className={optionClass}
                onClick={() => onToggleTopic(topic.slug)}
              >
                <Checkbox.Root
                  checked={checked}
                  tabIndex={-1}
                  aria-hidden="true"
                  className={cx(
                    "article-filter-bar__checkbox",
                    classNames?.checkbox,
                  )}
                >
                  <Checkbox.Indicator>
                    <CheckIcon />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span
                  className={cx(
                    "article-filter-bar__option-label",
                    classNames?.optionLabel,
                  )}
                >
                  {topic.name}
                </span>
                <span
                  className={cx("article-filter-bar__count", classNames?.count)}
                >
                  {topic.count}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={cx("article-filter-bar__clear", classNames?.clear)}
            onClick={onClearTopics}
          >
            {text.clear}
          </button>
        </FilterControl>
      )}

      {showYears && (
        <FilterControl
          label={selectedYear === "" ? text.allYears : selectedYear}
          ariaLabel={text.yearsAriaLabel}
          classNames={classNames}
        >
          {["", ...yearOptions].map((year) => (
            <button
              type="button"
              key={year || "all"}
              role="option"
              aria-selected={selectedYear === year}
              className={optionClass}
              onClick={() => onYearChange(year)}
            >
              <span
                className={cx(
                  "article-filter-bar__option-label",
                  classNames?.optionLabel,
                )}
              >
                {year === "" ? text.allYears : year}
              </span>
            </button>
          ))}
        </FilterControl>
      )}

      <FilterControl
        label={
          sortOptions.find((option) => option.value === sort)?.label ??
          sortOptions[0].label
        }
        ariaLabel={text.sortAriaLabel}
        classNames={classNames}
      >
        {sortOptions.map((option) => (
          <button
            type="button"
            key={option.value}
            role="option"
            aria-selected={sort === option.value}
            className={optionClass}
            onClick={() => onSortChange(option.value)}
          >
            <span
              className={cx(
                "article-filter-bar__option-label",
                classNames?.optionLabel,
              )}
            >
              {option.label}
            </span>
          </button>
        ))}
      </FilterControl>

      {children}
    </div>
  );
};
