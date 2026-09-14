"use client";

export function AcademyListTools({ label, query, onQuery, filter, onFilter, options, count }: {
  label: string; query: string; onQuery: (value: string) => void; filter: string; onFilter: (value: string) => void;
  options: { value: string; label: string; count: number }[]; count: number;
}) {
  return <section aria-label={`${label}の検索と絞り込み`} className="space-y-2 text-[var(--mikke-text)]">
    <label className="block text-sm font-bold">{label}を検索
      <input type="search" value={query} onChange={e => onQuery(e.target.value)} placeholder="名前で検索" className="mt-1 min-h-10 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 text-base font-medium" />
    </label>
    <div className="flex flex-wrap justify-end gap-1.5">{options.map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => onFilter(option.value)} className={`min-h-9 rounded-lg border px-2 text-[11px]! font-medium! ${filter === option.value ? "border-[var(--mikke-primary)]" : "border-[var(--mikke-line)]"}`}>{option.label} {option.count}件</button>)}</div>
    <p role="status" className="text-xs font-medium">表示中 {count}件{query ? ` · 「${query}」の検索結果` : ""}</p>
  </section>;
}
