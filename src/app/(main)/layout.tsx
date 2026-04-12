import Link from "next/link";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-gray-200 bg-white px-6 py-3">
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
      <div className="pt-12.25">
        {children}
      </div>
    </>
  );
}
