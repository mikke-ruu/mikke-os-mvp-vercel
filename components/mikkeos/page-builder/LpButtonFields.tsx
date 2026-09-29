"use client";
import { LpButton, buttonValues, type LpButtonStyle } from "./LpButton";
import { bounded, type LpBlock } from "./lp-design";
import styles from "./lp-button.module.css";

export function LpButtonFields({ block, onChange, tab }: { block: LpBlock; onChange: (block: LpBlock) => void; tab: "content" | "design" }) {
  const value = buttonValues(block);
  const patch = (change: Partial<LpButtonStyle>) => onChange({ ...block, lp: { ...block.lp, button: { ...value, ...change } } });
  return <div>
    <div className={styles.preview} aria-label="ボタンの見え方"><LpButton block={block} preview /></div>
    {tab === "content" ? <>
      <label>ボタンの文字<input value={block.buttonLabel ?? ""} placeholder="詳しく見る" onChange={event => onChange({ ...block, buttonLabel: event.target.value })} /></label>
      <label>リンク先URL（後で設定できます）<input type="url" placeholder="https://" value={block.url ?? ""} onChange={event => onChange({ ...block, url: event.target.value })} /></label>
      <p>リンク未設定でもボタンは表示されます。設定するまで移動はしません。</p>
    </> : <>
      <label>ボタンの種類<select value={value.variant} onChange={event => { const variant = event.target.value as LpButtonStyle["variant"]; patch({ variant, color: variant === "filled" ? "#ffffff" : value.background }); }}><option value="filled">塗りつぶし</option><option value="outline">枠線</option><option value="plain">枠線なし</option></select></label>
      <div className={styles.colors}>{([["background", "背景色"], ["color", "文字色"], ["border", "枠線色"]] as const).filter(([key]) => key === "color" || key === "background" && value.variant === "filled" || key === "border" && value.variant === "outline").map(([key, label]) => <label key={key}>{label}<span className={styles.colorRow}><input type="color" aria-label={`ボタンの${label}`} value={value[key]} onChange={event => patch({ [key]: event.target.value })}/><code>{value[key]}</code></span></label>)}</div>
      <label>ボタンの幅<select value={value.width === "full" ? "full" : value.width ? "fixed" : "auto"} onChange={event => patch({ width: event.target.value === "full" ? "full" : event.target.value === "fixed" ? 200 : undefined })}><option value="auto">文字に合わせる</option><option value="fixed">幅を指定する</option><option value="full">横幅いっぱい</option></select></label>
      {typeof value.width === "number" && <label>幅（px）<input type="number" min={60} max={1200} value={value.width} onChange={event => patch({ width: bounded(Number(event.target.value), 60, 1200) })}/></label>}
      <label>ボタンの配置<select value={value.align} onChange={event => patch({ align: event.target.value as LpButtonStyle["align"] })}><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select></label>
      {([["size", "文字サイズ", 12, 48], ["radius", "角丸", 0, 80], ["paddingX", "左右の余白", 0, 100], ["paddingY", "上下の余白", 0, 60]] as const).map(([key, label, min, max]) => <label key={key}>{label}（px）<input type="number" min={min} max={max} value={value[key]} onChange={event => patch({ [key]: bounded(Number(event.target.value), min, max) })}/></label>)}
      {([["bold", "太字"], ["italic", "斜体"], ["underline", "下線"], ["shadow", "影"]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(value[key])} onChange={event => patch({ [key]: event.target.checked })}/>{label}</label>)}
    </>}
  </div>;
}
