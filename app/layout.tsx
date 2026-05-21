import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import DownloadsTray from "@/components/DownloadsTray";
import "./globals.css";

export const metadata: Metadata = {
  title: "Richmond Library",
  description: "Your personal digital library",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-bg-0 text-text-primary">
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-bg-0/75 border-b border-border-subtle">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" aria-hidden="true" className="h-10 w-auto" />
              Richmond Library
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/" icon={<Search size={14} />} label="Discover" />
              <NavLink href="/library" icon={<BookOpen size={14} />} label="Book Shelf" />
            </nav>
          </div>
        </header>
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">{children}</main>
        <DownloadsTray />
      </body>
    </html>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-1 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
