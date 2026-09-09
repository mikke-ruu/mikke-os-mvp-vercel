"use client";

import { useId, useState } from "react";

/** Click/keyboard disclosure, deliberately not hover-only. Never submits a surrounding form. */
export function AcademyHelp({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="block">
    <button type="button" aria-label={`${title}の説明`} aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}
      className="inline-flex min-h-11 min-w-11 items-center gap-1 text-sm text-[var(--mikke-primary)]">
      <span aria-hidden="true" className="inline-flex size-5 items-center justify-center rounded-full border border-current text-xs font-bold">?</span>
      <span>{open ? "説明を閉じる" : "説明"}</span>
    </button>
    {open ? <span id={id} role="note" className="mb-3 block border-l-2 border-[var(--mikke-primary)] bg-white py-2 pl-3 text-sm font-normal leading-7 text-[var(--mikke-text)]"><strong className="block">{title}</strong>{children}</span> : null}
  </span>;
}
