"use client";
import type { CSSProperties } from "react";
import { bounded, safeLpColor, type LpBlock } from "./lp-design";
import styles from "./lp-button.module.css";

export type LpButtonStyle = {
  variant?: "filled" | "outline" | "plain";
  background?: string; color?: string; border?: string;
  width?: number | "full"; align?: "left" | "center" | "right";
  size?: number; radius?: number; paddingX?: number; paddingY?: number;
  bold?: boolean; italic?: boolean; underline?: boolean; shadow?: boolean;
};
export function buttonValues(block: LpBlock): LpButtonStyle {
  return { variant: "filled", background: "#454bb4", color: "#ffffff", border: "#454bb4", align: "center", size: 16, radius: 8, paddingX: 24, paddingY: 12, bold: true,
    ...Object.fromEntries(Object.entries(block.lp?.desktop ?? {}).filter(([key]) => ["background", "color", "border", "size", "radius", "shadow"].includes(key))), ...block.lp?.button };
}
function buttonHref(value?: string) {
  if (!value?.trim()) return undefined;
  if (/^\/[\w/#?%-]/.test(value) && !value.startsWith("//")) return value;
  if (/^#[\w-]+$/.test(value)) return value;
  try { const url = new URL(value); if (["https:", "http:"].includes(url.protocol)) return url.href; } catch { /* Draft or invalid link. */ }
}
export function LpButton({ block, preview = false }: { block: LpBlock; preview?: boolean }) {
  const value = buttonValues(block);
  const style: CSSProperties = {
    background: value.variant === "filled" ? safeLpColor(value.background) ?? "var(--mikke-primary)" : "transparent",
    color: safeLpColor(value.color) ?? "var(--mikke-text)",
    border: `1px solid ${value.variant === "outline" ? safeLpColor(value.border) ?? "var(--mikke-primary)" : "transparent"}`,
    width: value.width === "full" ? "100%" : bounded(value.width, 60, 1200), maxWidth: "100%",
    fontSize: bounded(value.size, 12, 48), borderRadius: bounded(value.radius, 0, 80),
    padding: `${bounded(value.paddingY, 0, 60) ?? 12}px ${bounded(value.paddingX, 0, 100) ?? 24}px`,
    fontWeight: value.bold ? 700 : 400, fontStyle: value.italic ? "italic" : "normal", textDecoration: value.underline ? "underline" : "none",
    boxShadow: value.shadow ? "0 4px 12px #00000026" : "none",
  };
  const href = buttonHref(block.url);
  return <div className={styles.wrapper} style={{ textAlign: value.align === "left" || value.align === "right" ? value.align : "center" }}>
    {href && !preview ? <a className={styles.button} style={style} href={href} target={href.startsWith("/") || href.startsWith("#") ? undefined : "_blank"} rel={href.startsWith("/") || href.startsWith("#") ? undefined : "noopener noreferrer"}>{block.buttonLabel || "詳しく見る"}</a> : <button className={styles.button} style={style} type="button" aria-disabled="true">{block.buttonLabel || "詳しく見る"}</button>}
  </div>;
}
