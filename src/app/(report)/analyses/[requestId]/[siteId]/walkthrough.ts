import type { Tour } from "@/components/Walkthrough";
import { waitForSelector } from "@/components/Walkthrough";

export function makeSiteTour(_scope: {
  requestId: string;
  siteId: string;
}): Tour {
  return {
    id: "site-report",
    steps: [
      {
        target: '[data-tour="site-sidebar"]',
        title: "Sites",
        body:
          "Switch between sites in this analysis. Each site was fetched and analyzed independently using the same categories, so you can compare how different sites handle the same topics.",
      },
      {
        target: '[data-tour="site-category"]',
        title: "Categories",
        body:
          "Data is grouped by category (home, navigation, tech, assessments, etc.). Each category aggregates findings across all crawled pages for this site, giving you one consolidated view per topic instead of page-by-page noise.",
        skipIfMissing: true,
      },
      {
        target: '[data-tour="site-category-actions"]',
        title: "Category scope",
        body:
          "Category chat analyzes all the data across sites for this category. Copy exports the same data as structured context.",
        skipIfMissing: true,
      },
      {
        target: '[data-tour="site-page-actions"]',
        title: "Website scope",
        body:
          "Website chat is about this entire site — all pages, all categories. Copy exports the site's data.",
      },
      {
        target: '[data-tour="site-request-actions"]',
        title: "Analysis scope",
        body:
          "Analysis chat uses data for all pages across all sites in this analysis. Copy exports the full analysis.",
      },
      {
        target: '[data-tour="site-chat-drawer"]',
        title: "Scoped chat",
        body:
          "Answers are grounded strictly in the scope you picked — no leakage across unrelated data.",
        onBefore: async () => {
          window.dispatchEvent(new CustomEvent("walkthrough:open-chat"));
          await waitForSelector('[data-tour="site-chat-drawer"]', { timeout: 2500 });
        },
        onAfter: () => {
          window.dispatchEvent(new CustomEvent("walkthrough:close-chat"));
        },
      },
    ],
  };
}
