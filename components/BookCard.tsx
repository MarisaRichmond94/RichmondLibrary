"use client";

import Image from "next/image";
import { BookOpen } from "lucide-react";

type Props = {
  title: string;
  authors: string[];
  coverUrl?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
};

export default function BookCard({ title, authors, coverUrl, onClick, badge }: Props) {
  const authorLine = authors.join(", ") || "Unknown author";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left flex flex-col gap-2 cursor-pointer focus:outline-none"
    >
      <div className="relative aspect-[2/3] w-full rounded-md overflow-hidden bg-bg-2 book-cover-shadow group-hover:scale-[1.025] transition-transform">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 33vw, (max-width: 1280px) 20vw, 180px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-tertiary">
            <BookOpen size={36} />
          </div>
        )}
        {badge ? (
          <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider bg-black/60 backdrop-blur px-1.5 py-0.5 rounded">
            {badge}
          </div>
        ) : null}
      </div>
      <div className="px-0.5">
        <div className="text-sm font-medium leading-tight line-clamp-2">{title}</div>
        <div className="text-xs text-text-secondary line-clamp-1 mt-0.5">{authorLine}</div>
      </div>
    </button>
  );
}
