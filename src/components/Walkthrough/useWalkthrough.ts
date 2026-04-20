"use client";

import { useCallback } from "react";
import { driver, type Config, type DriveStep } from "driver.js";
import type { Step, Tour } from "./types";

const SEEN_PREFIX = "walkthrough:";
const SEEN_SUFFIX = ":seen";

function seenKey(id: string) {
  return `${SEEN_PREFIX}${id}${SEEN_SUFFIX}`;
}

function readSeen(id: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    window.localStorage.setItem(seenKey(id), "1");
  } catch {
    /* ignore */
  }
}

function clearSeen(id: string) {
  try {
    window.localStorage.removeItem(seenKey(id));
  } catch {
    /* ignore */
  }
}

function isHidden(s: Step): boolean {
  return !!s.skipIfMissing && !document.querySelector(s.target);
}

function findNextVisible(steps: Step[], from: number): number | null {
  for (let i = from; i < steps.length; i++) {
    if (!isHidden(steps[i])) return i;
  }
  return null;
}

function findPrevVisible(steps: Step[], from: number): number | null {
  for (let i = from; i >= 0; i--) {
    if (!isHidden(steps[i])) return i;
  }
  return null;
}

async function runSafely(fn?: () => Promise<void> | void) {
  if (!fn) return;
  try {
    await fn();
  } catch {
    /* ignore */
  }
}

export function useWalkthrough(tour: Tour) {
  const run = useCallback(() => {
    (async () => {
      const steps = tour.steps;
      const first = findNextVisible(steps, 0);
      if (first === null) return;

      await runSafely(steps[first].onBefore);

      const driveSteps: DriveStep[] = steps.map((s) => ({
        element: () => document.querySelector(s.target) ?? document.body,
        popover: {
          title: s.title,
          description: s.body,
        },
        onDeselected: s.onAfter
          ? () => {
              try {
                s.onAfter!();
              } catch {
                /* ignore */
              }
            }
          : undefined,
      }));

      const config: Config = {
        showProgress: true,
        allowClose: true,
        popoverClass: "walkthrough-popover",
        stagePadding: 6,
        stageRadius: 8,
        steps: driveSteps,
        onDestroyed: () => markSeen(tour.id),
        onNextClick: (_el, _step, opts) => {
          (async () => {
            const current = opts.driver.getActiveIndex() ?? 0;
            const next = findNextVisible(steps, current + 1);
            if (next === null) {
              opts.driver.destroy();
              return;
            }
            await runSafely(steps[next].onBefore);
            // re-check in case onBefore didn't make the target appear
            if (isHidden(steps[next])) {
              const after = findNextVisible(steps, next + 1);
              if (after === null) {
                opts.driver.destroy();
                return;
              }
              await runSafely(steps[after].onBefore);
              opts.driver.moveTo(after);
              return;
            }
            opts.driver.moveTo(next);
          })();
        },
        onPrevClick: (_el, _step, opts) => {
          (async () => {
            const current = opts.driver.getActiveIndex() ?? 0;
            const prev = findPrevVisible(steps, current - 1);
            if (prev === null) return;
            await runSafely(steps[prev].onBefore);
            opts.driver.moveTo(prev);
          })();
        },
        onCloseClick: (_el, _step, opts) => {
          opts.driver.destroy();
        },
      };

      const d = driver(config);
      d.drive(first);
    })();
  }, [tour]);

  const replay = useCallback(() => {
    clearSeen(tour.id);
    run();
  }, [tour, run]);

  const isSeen = useCallback(() => readSeen(tour.id), [tour]);

  return { run, replay, isSeen };
}
