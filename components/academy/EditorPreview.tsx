"use client";

import { useState, type ReactNode } from "react";

/** Preview reads only the editor state. It never saves or changes publication. */
export function EditorPreview({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  const [mode, setMode] = useState<"edit" | "split" | "preview">("split");
  const [mobile, setMobile] = useState(false);
  const button = "min-h-11 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm aria-pressed:bg-[var(--mikke-primary)] aria-pressed:text-white";
  return <div className="space-y-4">
    <div className="space-y-2 border-b border-[var(--mikke-line)] bg-white pb-3">
      <div className="flex flex-wrap gap-2" aria-label="編集とプレビューの切り替え">
        <button type="button" className={button} aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>編集する</button>
        <button type="button" className={`${button} hidden lg:block`} aria-pressed={mode === "split"} onClick={() => setMode("split")}>見ながら編集</button>
        <button type="button" className={button} aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>プレビュー</button>
        <button type="button" className={button} aria-pressed={mobile} onClick={() => { setMobile(!mobile); setMode("preview"); }}>スマホ幅</button>
      </div>
      <p className="text-xs leading-5 text-[var(--mikke-muted)]">編集中にプレビューで確認できます。</p>
    </div>
    <div className={mode === "split" ? "grid items-start gap-5 lg:grid-cols-2" : ""}>
      <div className={mode === "preview" ? "hidden" : "min-w-0"}>{children}</div>
      <section aria-label="入力中のページのプレビュー" className={mode === "edit" ? "hidden" : mode === "split" ? "hidden min-w-0 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto" : "min-w-0"}>
        <div className={`mx-auto overflow-hidden bg-white p-4 ${mobile ? "max-w-[390px]" : "w-full"}`}>
          <p className="mb-4 border-b border-[var(--mikke-line)] pb-2 text-xs text-[var(--mikke-muted)]">保存前のプレビュー{mobile ? " · スマホ幅" : ""}</p>
          {preview}
        </div>
      </section>
    </div>
  </div>;
}
