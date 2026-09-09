"use client";

export function AcademyListTools({ label, query, onQuery, filter, onFilter, options, count }: {
  label: string; query: string; onQuery: (value: string) => void; filter: string; onFilter: (value: string) => void;
  options: { value: string; label: string; count: number }[]; count: number;
}) {
  return <section aria-label={`${label}の検索と絞り込み`} className="space-y-3 border-y border-[var(--mikke-line)] py-4">
    <label className="block text-sm font-bold">{label}を検索
      <input type="search" value={query} onChange={e => onQuery(e.target.value)} placeholder="名前で検索" className="mt-2 min-h-11 w-full border border-[var(--mikke-line)] bg-white px-3 text-base font-normal" />
    </label>
    <div className="flex flex-wrap gap-2">{options.map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => onFilter(option.value)} className={`min-h-11 border px-3 text-sm ${filter === option.value ? "border-[var(--mikke-primary)] font-bold text-[var(--mikke-primary)]" : "border-[var(--mikke-line)]"}`}>{option.label} {option.count}件</button>)}</div>
    <p role="status" className="text-sm text-[var(--mikke-muted)]">表示中 {count}件{query ? ` · 「${query}」の検索結果` : ""}</p>
  </section>;
}
