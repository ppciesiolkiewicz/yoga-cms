import type { Tour } from "@/components/Walkthrough";

export const analysesTour: Tour = {
  id: "analyses",
  steps: [
    {
      target: '[data-tour="analyses-table"]',
      title: "Your analyses",
      body: "Every analysis you've submitted shows up here.",
    },
    {
      target: '[data-tour="analyses-status"]',
      title: "Status",
      body: "Progress per site — pending, processing, complete, or rejected.",
    },
    {
      target: '[data-tour="analyses-row"]',
      title: "Open a report",
      body: "Click a row to open its full report.",
      skipIfMissing: true,
    },
  ],
};
