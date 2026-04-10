import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">YogaCMS</h1>
      <p className="mt-2 text-gray-600">Website assessment tool for yoga studios.</p>
      <Link href="/browse-data" className="mt-4 inline-block text-blue-600 hover:underline">
        Browse scraped data &rarr;
      </Link>
      <br />
      <Link href="/research" className="mt-2 inline-block text-blue-600 hover:underline">
        Yoga studio software research &rarr;
      </Link>
    </main>
  );
}
