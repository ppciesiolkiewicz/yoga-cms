/**
 * Polls the DOM for a selector. Resolves when found, rejects on timeout.
 * Used by tour steps that highlight elements added after a user action
 * (e.g., a drawer rendered only once a button is clicked).
 */
export function waitForSelector(
  selector: string,
  { timeout = 2000, interval = 50 }: { timeout?: number; interval?: number } = {},
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const found = document.querySelector(selector);
    if (found) return resolve(found);

    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error(`waitForSelector timeout: ${selector}`));
      }
    }, interval);
  });
}
