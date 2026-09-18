"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Plus } from "lucide-react";
import type { AcademyPageBlock } from "@/types/database";
import { moveLesson, readLessons, writeLessons, type AcademyLesson } from "@/lib/academy/lesson-content";
import { AcademyContentEditor } from "./AcademyContentEditor";
import { AcademyLessonContent } from "./AcademyLessonContent";
import styles from "./academy-lesson-editor.module.css";

export function AcademyLessonEditor({ blocks, curriculum, onChange }: { blocks: AcademyPageBlock[]; curriculum: string[]; onChange: (blocks: AcademyPageBlock[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const lessons = readLessons(blocks, curriculum);
  const change = (next: AcademyLesson[]) => onChange(writeLessons(next));
  return <div className={styles.root}>
    <p className={styles.help}>教材本文は受講者向けです。募集の講座カードにはカリキュラムの名前だけを表示します。</p>
    <section className={styles.panel}>
      <h2>レッスン内容</h2><p className={styles.help}>マイページの「受講する」に表示する内容です。</p>
      {lessons.map((lesson, index) => <div key={lesson.id} className={styles.item}>
        <div className={styles.row}>
          <button type="button" className={styles.name} aria-expanded={expanded === lesson.id} aria-controls={`lesson-${lesson.id}`} onClick={() => setExpanded(expanded === lesson.id ? null : lesson.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{lesson.title || "新しいレッスン"}</strong><ChevronDown size={18} /></button>
          <button type="button" aria-label={`${lesson.title || "レッスン"}を上へ`} disabled={index === 0} onClick={() => change(moveLesson(lessons, index, -1))}><ArrowUp size={16} /></button>
          <button type="button" aria-label={`${lesson.title || "レッスン"}を下へ`} disabled={index === lessons.length - 1} onClick={() => change(moveLesson(lessons, index, 1))}><ArrowDown size={16} /></button>
        </div>
        {expanded === lesson.id && <div id={`lesson-${lesson.id}`} className={styles.editor}>
          <label>レッスン名<input value={lesson.title} onChange={event => change(lessons.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} /></label>
          <AcademyContentEditor blocks={lesson.blocks} onChange={next => change(lessons.map((item, i) => i === index ? { ...item, blocks: next } : item))} />
          <button type="button" onClick={() => { if (window.confirm("このレッスンと教材本文を削除しますか？保存するまでは本番の教材は変わりません。")) { change(lessons.filter((_, i) => i !== index)); setExpanded(null); } }}>レッスンを削除</button>
        </div>}
      </div>)}
      <button type="button" className={styles.add} onClick={() => { const id = crypto.randomUUID(); change([...lessons, { id, title: "", blocks: [] }]); setExpanded(id); }}><Plus size={17} />レッスンを追加</button>
    </section>
    <div className={styles.previewAction}><button type="button" aria-expanded={preview} onClick={() => setPreview(!preview)}>{preview ? "受講画面を閉じる" : "受講画面を確認"}</button></div>
    {preview && <section className={styles.panel}><h2>受講画面のプレビュー</h2><p className={styles.help}>保存前の内容です。受講者への表示は下の設定と保存で反映します。</p><AcademyLessonContent blocks={writeLessons(lessons)} /></section>}
  </div>;
}
