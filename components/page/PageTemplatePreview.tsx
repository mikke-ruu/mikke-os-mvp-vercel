"use client";

import { useMemo } from "react";
import { emptyPageCmsContent } from "@/lib/page/cms-selectors";
import { createStarterTemplate, defaultPageHtmlDocument, pageThemePresets, type PageStarterTemplateId } from "@/lib/page/templates";
import { PageDeviceFrame } from "./PageDeviceFrame";
import { PageRenderer } from "./PageRenderer";

const previewNames: Record<PageStarterTemplateId, string> = {
  company: "会社・団体",
  service: "サービス",
  portfolio: "作品・実績",
  "connect-partners": "CMSポータル",
  blank: "白紙"
};

// テンプレートごとに雰囲気の異なるプリセットを当てて、選ぶ楽しさを見せる
const previewThemeIds: Record<PageStarterTemplateId, keyof typeof pageThemePresets> = {
  company: "soft",
  service: "modern",
  portfolio: "serif",
  "connect-partners": "gothic",
  blank: "gothic"
};

export function PageTemplatePreview({ templateId, selected = false }: { templateId: PageStarterTemplateId; selected?: boolean }) {
  const blocks = useMemo(() => createStarterTemplate(templateId), [templateId]);
  const theme = pageThemePresets[previewThemeIds[templateId]];

  return (
    <div
      aria-hidden="true"
      className={`relative aspect-[16/10] overflow-hidden rounded-xl border bg-white ${selected ? "border-[var(--mikke-accent)]" : "border-[var(--mikke-line-soft)]"}`}
    >
      <div className="relative z-10 flex h-5 items-center gap-1 border-b border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] px-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mikke-accent)]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mikke-primary-border)]" />
        <span className="ml-auto h-1 w-10 rounded-full bg-[var(--mikke-line)]" />
      </div>
      <div className="h-[calc(100%-1.25rem)]">
        {blocks.length === 0 ? (
          <div className="grid h-full place-items-center bg-gradient-to-br from-[var(--mikke-surface-soft)] to-white">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-[var(--mikke-primary-border)] text-lg text-[var(--mikke-muted)]">＋</div>
          </div>
        ) : (
          <PageDeviceFrame device="desktop" zoomMode="auto" mode="crop" className="pointer-events-none">
            <PageRenderer
              document={{ mode: "builder", blocks, htmlDocument: defaultPageHtmlDocument }}
              theme={theme}
              cmsContent={emptyPageCmsContent}
              compact
            />
          </PageDeviceFrame>
        )}
      </div>
      <span className="absolute bottom-2 right-2 z-10 rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold text-[var(--mikke-muted)] shadow-sm">{previewNames[templateId]}</span>
    </div>
  );
}
