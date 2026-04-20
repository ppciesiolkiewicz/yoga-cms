"use client";

import { useEffect, useRef } from "react";
import { useWalkthrough } from "./useWalkthrough";
import type { Tour } from "./types";

type Props = {
  tour: Tour;
  autoStart?: boolean;
};

export function Walkthrough({ tour, autoStart = true }: Props) {
  const { run, isSeen } = useWalkthrough(tour);
  const started = useRef(false);

  useEffect(() => {
    if (!autoStart || started.current) return;
    if (isSeen()) return;
    started.current = true;
    const id = window.setTimeout(() => run(), 50);
    return () => window.clearTimeout(id);
  }, [autoStart, isSeen, run]);

  return null;
}
