"use client";

import { useEffect, useRef, useState } from "react";

export type PageViewportDevice = "desktop" | "tablet" | "mobile";

export const pageDeviceWidths: Record<PageViewportDevice, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 390
};

export type PageZoomMode = "auto" | 50 | 60 | 75 | 100;

/**
 * デバイス幅で組まれたページを、枠幅に合わせて自動スケール表示する共通コンポーネント。
 * - mode="content"（既定）: 枠の高さをスケール後のコンテンツ高さに合わせる（横スクロールなし、全体表示）。
 *   編集画面のプレビューやサイト全体プレビューで使用。
 * - mode="crop": 枠は親要素のサイズ（例: aspect-ratioで固定した高さ）いっぱいに広がり、
 *   はみ出た分は隠す（縮小サムネイル用）。テンプレートカードや「最近のサイト」カードで使用。
 */
export function PageDeviceFrame({
  device,
  zoomMode,
  mode = "content",
  className,
  contentClassName,
  children
}: {
  device: PageViewportDevice;
  zoomMode: PageZoomMode;
  mode?: "content" | "crop";
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const deviceWidth = pageDeviceWidths[device];

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mode !== "content") return;
    const el = contentRef.current;
    if (!el) return;
    setContentHeight(el.scrollHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) setContentHeight(height);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // device/childrenの変化でコンテンツ高さが変わるため再計測する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, device, children]);

  const scale = zoomMode === "auto" ? (containerWidth > 0 ? Math.min(1, containerWidth / deviceWidth) : 1) : Math.max(0.1, zoomMode / 100);

  return (
    <div ref={frameRef} className={`${mode === "crop" ? "relative h-full w-full overflow-hidden" : ""} ${className ?? ""}`}>
      <div
        style={
          mode === "content"
            ? {
                height: contentHeight ? Math.ceil(contentHeight * scale) : undefined,
                overflow: "hidden",
                ...(zoomMode !== "auto" ? { overflowX: "auto", overflowY: "hidden" } : {})
              }
            : { position: "absolute", inset: 0, overflow: "hidden" }
        }
      >
        <div ref={contentRef} className={contentClassName} style={{ width: deviceWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
