"use client";

import { HelpCircle } from "lucide-react";
import { useWalkthrough } from "./useWalkthrough";
import type { Tour } from "./types";

type Props = {
  tour: Tour;
  className?: string;
};

export function WalkthroughButton({ tour, className }: Props) {
  const { replay } = useWalkthrough(tour);
  return (
    <button
      type="button"
      onClick={replay}
      aria-label="Replay walkthrough"
      title="Replay walkthrough"
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-alt hover:text-foreground " +
        (className ?? "")
      }
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}
