"use client";

import { useRef } from "react";
import { Eye, X } from "lucide-react";
import type { AcademyPageBlock } from "@/types/database";
import { AcademyLessonContent } from "./AcademyLessonContent";
import styles from "./academy-lesson-actions.module.css";

/** Preview uses the current draft and never changes its saved/publication state. */
export function AcademyLessonActions({ blocks, saving, saved, error, onSave }: {
  blocks: AcademyPageBlock[]; saving: boolean; saved: boolean; error: string; onSave: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  return <>
    <div className={styles.actions} aria-label="レッスンの保存とプレビュー">
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.buttons}>
        <span role="status" aria-live="polite" className={styles.status}>{saving ? "保存中です" : error ? "保存に失敗しました（未保存）" : saved ? "保存済み" : "未保存の内容があります"}</span>
        <button ref={previewButton} type="button" className={styles.preview} aria-label="レッスンをプレビュー" aria-haspopup="dialog" title="プレビュー" onClick={() => dialog.current?.showModal()}><Eye size={21} aria-hidden="true" /></button>
        <button type="button" className={styles.save} disabled={saving} onClick={onSave}>{saving ? "保存中…" : "保存する"}</button>
      </div>
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-label="受講画面のプレビュー" onClose={() => previewButton.current?.focus()}>
      <header className={styles.header}><div><h2>受講画面のプレビュー</h2><p>保存前の内容を確認できます。</p></div><button type="button" autoFocus aria-label="プレビューを閉じる" onClick={() => dialog.current?.close()}><X size={22} /></button></header>
      <div className={styles.content}><AcademyLessonContent blocks={blocks} /></div>
    </dialog>
  </>;
}
