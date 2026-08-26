"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ManagerAppSuggestion } from "@/lib/manager/app-suggestions";

export function ManagerAppSuggestions({ suggestions }: { suggestions: ManagerAppSuggestion[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {suggestions.map((suggestion) => (
        <Link key={suggestion.id} href={suggestion.href} className="rounded-xl border border-[var(--mikke-line)] border-l-[3px] border-l-[var(--mikke-orange)] bg-white px-3 py-2.5 shadow-sm sm:rounded-2xl sm:p-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[var(--mikke-orange)] sm:text-xs">
            <Sparkles size={13} />
            {suggestion.reason}
          </span>
          <p className="mt-1.5 text-xs font-bold text-[var(--mikke-text)] sm:mt-3 sm:text-sm">{suggestion.title}</p>
          <p className="mt-0.5 text-[10px] font-semibold leading-4 text-[var(--mikke-muted)] sm:mt-1 sm:text-xs sm:leading-5">{suggestion.helper}</p>
        </Link>
      ))}
    </div>
  );
}

