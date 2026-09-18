"use client";
import { useId, useState, useRef, useEffect, type ReactNode } from "react";
import { ArrowUp, ArrowDown, Copy, Trash2, ChevronDown, ChevronUp, X, Eye, EyeOff } from "lucide-react";
import { LpContent } from "./LpDesign";
import { findLpBlock, newFaqItem, operateLpBlock, sectionChoices, sectionTemplate, updateLpBlock } from "./lp-canvas";
import type { LpBlock } from "./lp-design";
import styles from "./lp-canvas.module.css";
import { LpRichWriting as MikkeRichWriting } from "./LpRichWriting";

export type LpFieldRenderer = (block: LpBlock, change: (b: LpBlock) => void, tab: "content" | "design") => ReactNode;
const examples: Record<string, string[]> = {
  "メイン": ["あなたの魅力が伝わる", "写真とキャッチコピー", "詳しく見る →"],
  "画像＋文章": ["▧ 写真", "見出し", "伝えたい内容を紹介"],
  "特徴": ["特徴 01", "特徴 02", "特徴 03"],
  "よくある質問": ["Q. 初めてでも大丈夫？", "A. 基礎からご案内します", "Q. 何を準備すればいい？"],
  "空のBOX": ["＋", "自由に組み立てる"],
};
const labels: Record<string, string> = { paragraph: "文章", heading: "見出し", image: "画像", "image-text": "画像＋文章", cta: "ボタン", gallery: "画像一覧", list: "リスト", quote: "引用", divider: "区切り", video: "動画", link: "リンク", links: "リンク一覧" };
function label(b: LpBlock) { return b.title || (b.lp?.children ? "BOX" : labels[b.type] || b.type); }
function blockPath(items: LpBlock[], id: string | null): string[] {
  for (const [index, item] of items.entries()) {
    const title = item.title || item.text?.slice(0, 24) || label(item);
    const own = item.title === "質問と回答" ? `質問${items.slice(0, index + 1).filter(b => b.title === "質問と回答").length}` : title;
    if (item.id === id) return [own];
    const child = blockPath(item.lp?.children ?? [], id);
    if (child.length) return [own, ...child];
  }
  return [];
}
export function LpCanvas({ blocks, onChange, renderContent, renderFields, title, footer, pageLabel = "ページ", fixedIds = [], hidePageTitle = false, extraTemplates = [] }: { blocks: LpBlock[]; onChange: (b: LpBlock[]) => void; renderContent: (b: LpBlock[]) => ReactNode; renderFields: LpFieldRenderer; title: string; footer?: ReactNode; pageLabel?: string; fixedIds?: string[]; hidePageTitle?: boolean; extraTemplates?: { label: string; description: string; create: () => LpBlock }[] }) {
  const instance = useId();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [stageVisible, setStageVisible] = useState(true);
  useEffect(() => {
    if (!mobile || !stage.current) return;
    const observer = new IntersectionObserver(([entry]) => setStageVisible(entry.isIntersecting), {
      rootMargin: "-64px 0px -68px 0px",
    });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, [mobile]);
  useEffect(() => {
    const query = window.matchMedia("(max-width:700px)");
    const sync = () => setMobile(query.matches);
    sync(); query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "design">("content");
  const [device, setDevice] = useState("desktop");
  const [reading, setReading] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [past, setPast] = useState<LpBlock[][]>([]), [future, setFuture] = useState<LpBlock[][]>([]);
  const [inspectorFocused, setInspectorFocused] = useState(false);
  const picker = useRef<HTMLDialogElement>(null);
  const block = selected ? findLpBlock(blocks, selected) : undefined;
  useEffect(() => { if (insertAt !== null) picker.current?.showModal(); else picker.current?.close(); }, [insertAt]);
  const commit = (next: LpBlock[]) => { setPast(p => [...p.slice(-29), structuredClone(blocks)]); setFuture([]); onChange(next); };
  const change = (b: LpBlock) => commit(updateLpBlock(blocks, b.id, () => b));
  const select = (id: string) => { setSelected(id); setReading(false); };
  const insertBlock = (added: LpBlock) => { const index = Math.min(blocks.length - (fixedIds.includes(blocks.at(-1)?.id ?? "") ? 1 : 0), Math.max(fixedIds.includes(blocks[0]?.id ?? "") ? 1 : 0, insertAt ?? blocks.length)); commit([...blocks.slice(0,index), added, ...blocks.slice(index)]); setSelected(added.id); setTab("content"); setInsertAt(null); };
  const operate = (action: "up" | "down" | "copy" | "delete") => { if (!selected || fixedIds.includes(selected)) return; commit(operateLpBlock(blocks, selected, action)); if (action === "delete") { setSelected(null); } };
  const addPart = (type: LpBlock["type"]) => { if (!block?.lp?.children) return; const part: LpBlock = { id: crypto.randomUUID(), type, text: type === "heading" ? "見出し" : type === "paragraph" ? "文章を入力" : "", ...(type === "cta" ? { title: "", buttonLabel: "詳しく見る", url: "" } : {}), ...(type === "gallery" ? { images: [] } : {}) }; change({ ...block, lp: { ...block.lp, children: [...block.lp.children, part] } }); setSelected(part.id); };
  const decorate = (b: LpBlock, content: ReactNode) => <div className={styles.box} data-selected={selected === b.id} data-box-id={b.id} onClick={event => { event.stopPropagation(); if ((event.target as HTMLElement).closest("a")) event.preventDefault(); select(b.id); }}>
    <button type="button" className={styles.select} aria-label={`${label(b)}を選択`} aria-pressed={selected === b.id} onClick={event => { event.stopPropagation(); select(b.id); }}>{label(b)}</button>
    {selected === b.id && !fixedIds.includes(b.id) && <div className={styles.boxActions} role="group" aria-label={`${label(b)}の操作`} onClick={event => event.stopPropagation()}>
      <span>{label(b)}</span>
      {([{ action: "up", name: "上へ", Icon: ArrowUp }, { action: "down", name: "下へ", Icon: ArrowDown }, { action: "copy", name: "複製", Icon: Copy }, { action: "delete", name: "削除", Icon: Trash2 }] as const).map(({ action, name, Icon }) => <button key={action} type="button" title={name} aria-label={name} onClick={() => operate(action)}><Icon size={14} aria-hidden="true"/></button>)}
    </div>}
    {content}{b.lp?.children?.length === 0 && <p className={styles.emptyBox}>{mobile ? "下の設定から内容を追加" : "右側から内容を追加"}</p>}
  </div>;
  const canvasContent = (items: LpBlock[]) => items.map(b => !reading && !fixedIds.includes(b.id) && !b.lp?.reference && selected === b.id && (b.type === "heading" || b.type === "paragraph") ? <MikkeRichWriting key={b.id} compact onDesign={() => { setTab("design"); setCollapsed(false); }} block={b} onChange={change}/> : <div key={b.id}>{renderContent([b])}</div>);
  const inspector = <><header title={blockPath(blocks, selected).join(" › ")}>
    {mobile ? <button type="button" className={styles.inspectorToggle} aria-expanded={!collapsed} aria-label={`${block ? label(block) : "BOX"}の設定を${collapsed ? "開く" : "小さくする"}`} onClick={() => setCollapsed(!collapsed)}>{block ? label(block) : "BOXを選択"}{collapsed ? <ChevronUp size={14} aria-hidden="true"/> : <ChevronDown size={14} aria-hidden="true"/>}</button> : <strong>{block ? label(block) : "BOXを選択"}</strong>}
    <span className={styles.srOnly} aria-label="編集中の場所">{blockPath(blocks, selected).join(" › ")}</span>
    <button type="button" className={styles.inspectorClose} title="プレビュー" aria-label="プレビューを見る" onClick={() => setReading(true)}><Eye size={16} aria-hidden="true"/></button>{block && <button type="button" className={styles.inspectorClose} onClick={() => setSelected(null)} aria-label="BOXの選択を解除"><X size={16} aria-hidden="true"/></button>}
  </header>
        <div className={styles.tabs} role="tablist" aria-label="BOXの編集タブ">{(["content", "design"] as const).map(t => <button key={t} id={`${instance}-tab-${t}`} type="button" role="tab" aria-selected={tab === t} aria-controls={`${instance}-inspector-panel`} onClick={() => setTab(t)}>{t === "content" ? "内容" : "デザイン"}</button>)}</div>
        <div id={`${instance}-inspector-panel`} role="tabpanel" aria-labelledby={`${instance}-tab-${tab}`} className={styles.fields}>
          {!block ? <p>中央のBOXを選んでください。</p> : fixedIds.includes(block.id) || block.lp?.reference ? renderFields(block, change, tab) : tab === "content" && block.lp?.children ? <><label>セクション名<input value={block.title ?? ""} onChange={e => change({ ...block, title: e.target.value })}/></label>{(block.lp.template === "faq" || block.title === "よくある質問") && <button type="button" className={styles.faqAdd} onClick={() => change({ ...block, lp: { ...block.lp, children: [...block.lp!.children!, newFaqItem()] } })}>＋ 質問と回答を追加</button>}<div className={styles.parts}>{(["heading", "paragraph", "image", "image-text", "cta", "gallery"] as const).map(type => <button key={type} type="button" onClick={() => addPart(type)}>＋ {labels[type]}</button>)}</div><ul className={styles.childList}>{block.lp.children.map(child => <li key={child.id}><button type="button" onClick={() => select(child.id)}>{label(child)}　{child.text?.slice(0,18)}</button></li>)}</ul></> : mobile && tab === "content" && (block.type === "heading" || block.type === "paragraph") ? <p>ページの文字をタップして編集</p> : renderFields(block, change, tab)}
        </div>
      </>;
  return <div className={styles.root} data-mobile-sheet={mobile && !reading && Boolean(block)} data-sheet-collapsed={collapsed}>
    <div className={styles.toolbar}><div><button type="button" disabled={!past.length} onClick={() => { const previous = past.at(-1)!; setFuture(f => [...f, structuredClone(blocks)]); setPast(p => p.slice(0,-1)); onChange(previous); }}>戻す</button><button type="button" disabled={!future.length} onClick={() => { const next = future.at(-1)!; setPast(p => [...p, structuredClone(blocks)]); setFuture(f => f.slice(0,-1)); onChange(next); }}>やり直す</button></div><div aria-label="LP表示サイズ"><button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>PC</button><button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>スマホ</button></div><button type="button" aria-pressed={reading} onClick={() => setReading(!reading)}>{reading ? "編集に戻る" : "プレビュー"}</button></div>
    <div className={styles.layout} data-reading={reading}>
      {!reading && <nav className={styles.outline} aria-label="LPの構成"><strong>セクション</strong>{blocks.map((b, i) => <button type="button" key={b.id} aria-pressed={selected === b.id} onClick={() => { select(b.id); document.getElementById(`${instance}-section-${b.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}><small>{String(i+1).padStart(2,"0")}</small>{b.title || b.text?.slice(0,18) || label(b)}</button>)}<button type="button" onClick={() => setInsertAt(blocks.length)}>＋ 追加</button></nav>}
      <div ref={stage} className={styles.stage}><div className={styles.page} data-device={device}>{!hidePageTitle && <header className={styles.pageTitle}><small>{pageLabel}</small><h1>{title || "ページ名"}</h1></header>}{!reading && !hidePageTitle && <button type="button" className={styles.insert} onClick={() => setInsertAt(0)}>＋ セクション</button>}{blocks.map((b, i) => <div key={b.id} id={`${instance}-section-${b.id}`}><LpContent blocks={[b]} render={canvasContent} decorate={reading ? undefined : decorate}/>{!reading && b.id !== fixedIds.at(-1) && <button type="button" className={styles.insert} aria-label={`${i+1}番目の後にセクションを追加`} onClick={() => setInsertAt(i+1)}>＋</button>}</div>)}{footer}</div></div>
      {!reading && <aside className={styles.inspector} data-collapsed={mobile && collapsed} data-active={Boolean(block) && (!mobile || stageVisible || inspectorFocused)} onFocusCapture={() => setInspectorFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInspectorFocused(false); }} aria-label="選択したBOXの編集">{inspector}</aside>}

    </div>
    {reading && selected && <button type="button" className={styles.previewReturn} onClick={() => setReading(false)}><EyeOff size={16} aria-hidden="true"/>編集に戻る</button>}<dialog ref={picker} className={styles.picker} onCancel={() => setInsertAt(null)} aria-label="セクションのテンプレート"><header><h2>セクションを追加</h2><button type="button" aria-label="テンプレートを閉じる" onClick={() => setInsertAt(null)}>×</button></header><div className={styles.templates}>{extraTemplates.map(item => <button type="button" key={item.label} onClick={() => insertBlock(item.create())}><div className={styles.thumbnail}><strong>{item.label}</strong><span>{item.description}</span></div></button>)}{sectionChoices.map(kind => <button type="button" key={kind} onClick={() => insertBlock(sectionTemplate(kind))}><div aria-hidden="true" className={styles.thumbnail} data-kind={kind}>{examples[kind].map(text => <span key={text}>{text}</span>)}</div><strong>{kind}</strong></button>)}</div></dialog>
  </div>;
}
