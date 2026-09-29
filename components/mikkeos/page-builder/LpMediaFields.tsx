"use client";
import { bounded, type LpBlock } from "./lp-design";
export function LpMediaFields({ block, onChange, compact = false }: { compact?: boolean; block: LpBlock; onChange: (block: LpBlock) => void }) {
  const value = block.lp?.media ?? {};
  const patch = (change: NonNullable<NonNullable<LpBlock["lp"]>["media"]>) => onChange({ ...block, lp: { ...block.lp, media: { ...value, ...change } } });
  return <fieldset><legend>画像・動画のサイズ</legend>
    <div className="flex flex-wrap gap-2">{[[50,"小さめ"],[75,"標準"],[100,"全幅"]].map(([width,label]) => <button className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-3 py-2 aria-pressed:bg-[var(--mikke-primary-soft)]" key={width} type="button" aria-pressed={(value.width ?? 100) === width} onClick={() => patch({width: Number(width)})}>{label}</button>)}</div>
    <label>横幅（%）<input type="range" min={10} max={100} step={5} value={value.width ?? 100} onChange={event => patch({ width: Number(event.target.value) })}/><output>{value.width ?? 100}%</output></label>
    <details open={compact ? undefined : true}><summary>高さ・配置を調整</summary><label>高さ（px・空欄は自動）<input type="number" min={60} max={1600} placeholder="自動" value={value.height ?? ""} onChange={event => patch({ height: event.target.value === "" ? undefined : bounded(Number(event.target.value), 60, 1600) })}/></label>
    <label>配置<select value={value.align ?? "center"} onChange={event => patch({ align: event.target.value as "left" | "center" | "right" })}><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select></label>
    <label>画像の収め方<select value={value.fit ?? "contain"} onChange={event => patch({ fit: event.target.value as "contain" | "cover" })}><option value="contain">画像全体を表示</option><option value="cover">枠いっぱいに表示（切り抜き）</option></select></label>
    </details>
  </fieldset>;
}
