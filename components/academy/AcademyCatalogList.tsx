"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Copy, Plus, Search } from "lucide-react";
import styles from "./academy-catalog-list.module.css";

export type AcademyCatalogItem = {
  id: string; title: string; category: string; summary: string;
  image?: string | null; status?: string; filter?: string;
  editHref?: string; duplicateHref?: string; offeringHref?: string;
};

/** Data-free view: fetching, creation access and writes stay with the route. */
export function AcademyCatalogList({ kind, items, createHref, createDisabledReason, filters, beforeTools, children }: {
  kind: "course" | "offering"; items: AcademyCatalogItem[];
  createHref?: string; createDisabledReason?: string | null;
  filters?: { value: string; label: string }[]; beforeTools?: React.ReactNode; children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const label = kind === "course" ? "講座" : "販売プラン";
  const options = filters ?? [...new Set(items.map(item => item.category))].map(category => ({ value: category, label: category }));
  const visible = items.filter(item => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (filter === "all" || (item.filter ?? item.category) === filter));
  return <div className={styles.catalog}>
    <header>
      <div className={styles.titlebar}><div className={styles.eyebrow}>{kind === "course" ? "COURSES" : "SALES PLANS"}</div><h1>{label}</h1></div>
      <div className={styles.headbox}><p>{kind === "course" ? "教える内容とレッスン教材を管理します。" : "作った講座を組み合わせて、価格・支払い・受講方法など「どう売るか」を設定します。"}</p>{createHref ? <Link className={styles.primary} href={createHref}><Plus size={17} aria-hidden />{label}をつくる</Link> : <button className={styles.primary} disabled><Plus size={17} aria-hidden />{label}をつくる</button>}</div>
    </header>
    {beforeTools}
    <div className={styles.tools}><label className={styles.search}><Search size={18} aria-hidden /><input aria-label={`${label}を検索`} placeholder={`${label}名で検索`} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className={styles.filters} aria-label="絞り込み">{[{ value: "all", label: "すべて" }, ...options].map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div>
    </div><p className={styles.count} role="status">{visible.length}件</p>
    {createDisabledReason && <p className={styles.notice} role="status">{createDisabledReason}</p>}
    <div className={styles.list}>{visible.map(item => <article key={item.id} className={kind === "course" ? styles.courseCard : styles.offeringCard}>
      {item.editHref ? <Link className={styles.cardTop} href={item.editHref} aria-label={`${item.title}を編集`}><CatalogItemContent item={item} linked /></Link> : <div className={styles.cardTop}><CatalogItemContent item={item} /></div>}
      {(item.duplicateHref || item.offeringHref) && <div className={styles.cardActions}>{item.duplicateHref && <Link className={styles.duplicate} href={item.duplicateHref} aria-label={`${item.title}を複製`}><Copy size={15} aria-hidden />複製</Link>}{item.offeringHref && <Link href={item.offeringHref}>販売プランをつくる</Link>}</div>}
    </article>)}</div>
    {!visible.length && <p className={styles.empty}>{items.length ? `条件に合う${label}がありません。` : `${label}はまだありません。`}</p>}
    {children}
  </div>;
}

function CatalogItemContent({ item, linked = false }: { item: AcademyCatalogItem; linked?: boolean }) {
  return <><div className={styles.thumbnail}>{item.image ? <img src={item.image} alt="" /> : <BookOpen size={26} aria-hidden />}</div><div className={styles.cardTitle}><h2>{item.title}</h2><div className={styles.metadata}><span className={styles.category}>{item.category}</span><span>{item.summary}</span>{item.status && <span>{item.status}</span>}</div></div>{linked && <span className={styles.arrow} aria-hidden>›</span>}</>;
}
