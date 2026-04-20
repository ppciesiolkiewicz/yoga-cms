export { Walkthrough } from "./Walkthrough";
export { WalkthroughButton } from "./WalkthroughButton";
export type { Tour, Step } from "./types";
export { waitForSelector } from "./utils";

if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV !== "production"
) {
  (window as unknown as { __resetWalkthroughs?: () => void }).__resetWalkthroughs = () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("walkthrough:")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    console.log(`[walkthrough] cleared ${keys.length} keys`);
  };
}
