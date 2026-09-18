"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Copy, Plus, Search } from "lucide-react";
import styles from "./academy-catalog-list.module.css";

export type AcademyCatalogItem = {
  id: string; title: string; category: string; summary: string;
  image?: string | null; status?: string; filter?: string;
  editHref: string; duplicateHref?: string; offeringHref?: string;
};

/** Data-free view: fetching, creation access and writes stay with the route. */
export function AcademyCatalogList({ kind, items, createHref, createDisabledReason, filters, children }: {
  kind: "course" | "offering"; items: AcademyCatalogItem[];
  createHref?: string; createDisabledReason?: string | null;
  filters?: { value: string; label: string }[]; children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const label = kind === "course" ? "講座" : "募集";
  const options = filters ?? [...new Set(items.map(item => item.category))].map(category => ({ value: category, label: category }));
  const visible = items.filter(item => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (filter === "all" || (item.filter ?? item.category) === filter));
  return <div className={styles.catalog}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>MY ACADEMY</span><h1>{label}一覧</h1></div>{createHref ? <Link className={styles.primary} href={createHref}><Plus size={17} />{label}をつくる</Link> : <button className={styles.primary} disabled><Plus size={17} />{label}をつくる</button>}</header>
    <label className={styles.search}><Search size={18} aria-hidden /><input aria-label={`${label}を検索`} placeholder={`${label}名で検索`} value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className={styles.filters}><span>{visible.length}件</span>{[{ value: "all", label: "すべて" }, ...options].map(option => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div>
    {createDisabledReason && <p className={styles.notice} role="status">{createDisabledReason}</p>}
    <div className={styles.list}>{visible.map(item => <article key={item.id} className={kind === "course" ? styles.courseCard : styles.offeringCard}>
      <div className={styles.cardTop}>{kind === "course" && <div className={styles.thumbnail}>{item.image ? <img src={item.image} alt="" /> : <BookOpen size={30} />}</div>}<div className={styles.cardTitle}><span className={styles.category}>{item.category}</span><h2>{item.title}</h2><p>{item.summary}</p></div>{item.status && <span className={styles.status}>{item.status}</span>}</div>
      <div className={styles.cardActions}>{item.duplicateHref ? <Link className={styles.duplicate} href={item.duplicateHref} aria-label={`${item.title}を複製`}><Copy size={15} />複製</Link> : <span className={styles.duplicate} />}{item.offeringHref && <Link href={item.offeringHref}>募集をつくる</Link>}<Link className={kind === "course" ? styles.outline : styles.primary} href={item.editHref}>{kind === "course" ? "編集する" : "募集を編集"}</Link></div>
    </article>)}</div>
    {!visible.length && <p className={styles.empty}>{items.length ? `条件に合う${label}がありません。` : `${label}はまだありません。`}</p>}
    {children}
  </div>;
}
