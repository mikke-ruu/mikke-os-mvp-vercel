import type { PageStarterTemplateId } from "@/lib/page/templates";

const previewNames: Record<PageStarterTemplateId, string> = {
  company: "会社・団体",
  service: "サービス",
  portfolio: "作品・実績",
  "connect-partners": "CMSポータル",
  blank: "白紙"
};

export function PageTemplatePreview({ templateId, selected = false }: { templateId: PageStarterTemplateId; selected?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`relative aspect-[16/10] overflow-hidden rounded-xl border bg-white ${selected ? "border-[var(--mikke-accent)]" : "border-[var(--mikke-line-soft)]"}`}
    >
      <div className="flex h-5 items-center gap-1 border-b border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] px-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mikke-accent)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mikke-primary-border)]" />
        <span className="ml-auto h-1 w-10 rounded-full bg-[var(--mikke-line)]" />
      </div>
      {templateId === "blank" ? (
        <div className="grid h-[calc(100%-1.25rem)] place-items-center bg-[var(--mikke-surface-soft)]">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-[var(--mikke-primary-border)] text-lg text-[var(--mikke-muted)]">＋</div>
        </div>
      ) : (
        <div className="space-y-2 p-3">
          <div className={`rounded-lg p-3 ${templateId === "connect-partners" ? "bg-[var(--mikke-primary)]" : "bg-[var(--mikke-primary-soft)]"}`}>
            <div className={`h-1.5 w-10 rounded-full ${templateId === "connect-partners" ? "bg-white/60" : "bg-[var(--mikke-accent)]"}`} />
            <div className={`mt-2 h-2.5 w-3/4 rounded-full ${templateId === "connect-partners" ? "bg-white" : "bg-[var(--mikke-primary)]"}`} />
            <div className={`mt-1.5 h-1.5 w-1/2 rounded-full ${templateId === "connect-partners" ? "bg-white/50" : "bg-[var(--mikke-primary-border)]"}`} />
          </div>
          {templateId === "portfolio" ? (
            <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className={`aspect-square rounded ${item % 3 === 0 ? "bg-[var(--mikke-accent-soft)]" : item % 2 === 0 ? "bg-[var(--mikke-primary-soft)]" : "bg-[var(--mikke-surface-soft)]"}`} />)}</div>
          ) : templateId === "connect-partners" ? (
            <div className="grid grid-cols-2 gap-1.5">{["Story", "Item", "FUND", "Community"].map((label) => <div key={label} className="rounded-md border border-[var(--mikke-line-soft)] p-1.5"><div className="h-1 w-6 rounded-full bg-[var(--mikke-accent)]" /><div className="mt-1 h-1.5 w-3/4 rounded-full bg-[var(--mikke-line)]" /></div>)}</div>
          ) : (
            <div className={`grid gap-1.5 ${templateId === "service" ? "grid-cols-3" : "grid-cols-2"}`}>
              {[0, 1, ...(templateId === "service" ? [2] : [])].map((item) => <div key={item} className="rounded-md border border-[var(--mikke-line-soft)] p-2"><div className="h-5 rounded bg-[var(--mikke-surface-soft)]" /><div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-[var(--mikke-line)]" /><div className="mt-1 h-1 w-full rounded-full bg-[var(--mikke-line-soft)]" /></div>)}
            </div>
          )}
        </div>
      )}
      <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold text-[var(--mikke-muted)] shadow-sm">{previewNames[templateId]}</span>
    </div>
  );
}
