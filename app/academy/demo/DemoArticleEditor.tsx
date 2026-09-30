'use client';
import { useState } from 'react';
import { MikkeRichWriting } from '@/components/mikkeos/content/MikkeRichWriting';
import { AcademyContentRenderer } from '@/components/academy/AcademyContentRenderer';
import { academyContent, replaceAcademyContent } from '@/lib/academy/content-adapter';
import { createMikkeContentBlock } from '@/lib/mikkeos/content/blocks.js';
import type { MikkeContentBlock, MikkeContentBlockType } from '@/lib/mikkeos/content/types';
import type { AcademyPageBlock } from '@/types/database';
import styles from '@/components/academy2/lesson-article-editor.module.css';

const options: { type: MikkeContentBlockType; label: string }[] = [
  { type: 'paragraph', label: '文章' }, { type: 'heading', label: '見出し' },
  { type: 'image', label: '画像' }, { type: 'video', label: '動画' }, { type: 'link', label: 'リンク' },
];

export function DemoArticleEditor({ title, blocks, onChange, onSave, onBack, dirty, error }: {
  title: string; blocks: AcademyPageBlock[]; onChange: (next: AcademyPageBlock[]) => void;
  onSave: () => void; onBack: () => void; dirty: boolean; error: string;
}) {
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(false);
  const items = academyContent(blocks);
  const change = (next: MikkeContentBlock[]) => onChange(replaceAcademyContent(blocks, next));
  const update = (index: number, next: MikkeContentBlock) => change(items.map((item, i) => i === index ? next : item));
  const add = (type: MikkeContentBlockType) => { change([...items, createMikkeContentBlock(type)]); setAdding(false); setPreview(false); };
  return <section className={styles.root}>
    <header className={styles.header}><button onClick={onBack}>← 講座編集へ</button><h1>{title}</h1><button aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? '編集に戻る' : 'プレビュー'}</button></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p role="status" className={styles.status}>{dirty ? '未保存の変更があります。' : '保存済みです。'}</p>
    <p className={styles.hint}>デモ用教材です。このブラウザに保存されます。</p>
    <div className={styles.canvas} aria-label={preview ? '教材プレビュー' : '教材本文'}>
      {preview ? <AcademyContentRenderer blocks={items}/> : items.map((block, index) => <article className={styles.block} key={block.id}>
        <details className={styles.operations}><summary>…</summary><div><button onClick={() => change(items.filter((_, i) => i !== index))}>削除</button><button disabled={index === 0} onClick={() => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change(next); }}>上へ</button><button disabled={index === items.length - 1} onClick={() => { const next = [...items]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; change(next); }}>下へ</button></div></details>
        {block.type === 'paragraph' || block.type === 'heading' ? <MikkeRichWriting block={block} lineBreakOnEnter onChange={next => update(index, next)}/> : null}
        {block.type === 'image' ? <><AcademyContentRenderer blocks={[block]}/><details className={styles.settings} open><summary>画像を設定</summary><label>画像を選ぶ<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 700_000) { window.alert('デモ画像は700KB以下にしてください。'); return; } const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') update(index, { ...block, imageUrl: reader.result }); }; reader.readAsDataURL(file); }}/></label><label>説明<input value={block.alt ?? ''} onChange={event => update(index, { ...block, alt: event.target.value })}/></label></details></> : null}
        {block.type === 'video' || block.type === 'link' ? <><AcademyContentRenderer blocks={[block]}/><div className={styles.settings}><label>{block.type === 'video' ? '動画URL' : 'リンクURL'}<input value={block.url ?? ''} onChange={event => update(index, { ...block, url: event.target.value })}/></label><label>表示名<input value={block.title ?? ''} onChange={event => update(index, { ...block, title: event.target.value })}/></label></div></> : null}
      </article>)}
      {!items.length && <p className={styles.empty}>文章や見出しを追加して、教材を作り始めましょう。</p>}
    </div>
    <div className={styles.actions}><button onClick={() => setAdding(value => !value)}>＋ コンテンツを追加</button><button className={styles.save} onClick={onSave}>保存</button></div>
    {adding && <div className={styles.addPanel}><h2>コンテンツを追加</h2><div>{options.map(option => <button key={option.type} onClick={() => add(option.type)}>{option.label}</button>)}</div><button onClick={() => setAdding(false)}>閉じる</button></div>}
  </section>;
}
