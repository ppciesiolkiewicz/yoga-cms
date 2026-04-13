import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border-default bg-surface px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-6">
          <Link href="/" className="text-lg font-semibold text-foreground">
            WebAnalyzer
          </Link>
          <Link
            href="/analyses"
            className="text-sm text-foreground-secondary hover:text-foreground"
          >
            Analyses
          </Link>
          <Link
            href="/create"
            className="text-sm text-foreground-secondary hover:text-foreground"
          >
            Create
          </Link>
          <Link
            href="/faq"
            className="text-sm text-foreground-secondary hover:text-foreground"
          >
            FAQ
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </nav>
      <div className="pt-12.25">{children}</div>
    </>
  );
}
