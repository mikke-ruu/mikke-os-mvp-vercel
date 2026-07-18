"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ManagerAppSuggestion } from "@/lib/manager/app-suggestions";

export function ManagerAppSuggestions({ suggestions }: { suggestions: ManagerAppSuggestion[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {suggestions.map((suggestion) => (
        <Link key={suggestion.id} href={suggestion.href} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--mikke-accent-soft)] px-3 py-1 text-xs font-bold text-[var(--mikke-accent)]">
            <Sparkles size={14} />
            {suggestion.reason}
          </span>
          <p className="mt-3 text-sm font-bold text-[var(--mikke-text)]">{suggestion.title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">{suggestion.helper}</p>
        </Link>
      ))}
    </div>
  );
}

