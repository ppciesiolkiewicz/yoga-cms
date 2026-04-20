export type Step = {
  /** CSS selector; typically `[data-tour="..."]` */
  target: string;
  title: string;
  body: string;
  /** Runs before the step is shown. May open drawers, wait for selectors, etc. */
  onBefore?: () => Promise<void> | void;
  /** Runs when leaving the step (both forward and backward). */
  onAfter?: () => void;
  /** If true, step is silently skipped when `target` is not in the DOM at start. */
  skipIfMissing?: boolean;
};

export type Tour = {
  /** Unique tour id. Used as localStorage key suffix. */
  id: string;
  steps: Step[];
};
