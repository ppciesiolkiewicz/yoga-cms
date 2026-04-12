import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scraper",
  description: "Get information about the Internet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <nav className="border-b border-gray-200 bg-white px-6 py-3">
          <div className="mx-auto flex max-w-6xl items-center gap-6">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              YogaCMS
            </Link>
            <Link href="/browse-data" className="text-sm text-gray-600 hover:text-gray-900">
              Browse Data
            </Link>
            <Link href="/create" className="text-sm text-gray-600 hover:text-gray-900">
              Create
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
