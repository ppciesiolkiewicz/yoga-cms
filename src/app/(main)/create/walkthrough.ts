import type { Tour } from "@/components/Walkthrough";

export const createTour: Tour = {
  id: "create",
  steps: [
    {
      target: '[data-tour="create-search"]',
      title: "Search",
      body: "Search and select websites to analyze.",
    },
    {
      target: '[data-tour="create-sites"]',
      title: "Your sites",
      body: "Pick which sites to analyze.",
      skipIfMissing: true,
    },
    {
      target: '[data-tour="create-categories"]',
      title: "Categories",
      body: "Define analysis categories with prompts.",
      skipIfMissing: true,
      onBefore: () => {
        // Switch to the Categories tab (2nd tab) so the target is in the DOM.
        const tabs = document.querySelectorAll<HTMLElement>('[role="tab"]');
        tabs[1]?.click();
      },
    },
    {
      target: '[data-tour="create-review"]',
      title: "Review",
      body: "Review your setup before submitting.",
      skipIfMissing: true,
      onBefore: () => {
        const tabs = document.querySelectorAll<HTMLElement>('[role="tab"]');
        tabs[2]?.click();
      },
    },
  ],
};
