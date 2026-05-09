"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-ink text-cream">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-xl mb-8">Page not found</p>
      <Link href="/" className="px-6 py-2 bg-gold text-ink rounded hover:bg-opacity-80">
        Return Home
      </Link>
    </div>
  );
}
