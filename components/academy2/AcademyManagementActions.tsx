"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toAcademyContextHref } from '@/lib/academy/access-context';
import { getAcademy2Management, actAcademy2Management } from '@/lib/academy2/management';
import styles from './academy-management-actions.module.css';

type Kind = 'course' | 'plan' | 'event';
type Snapshot = Awaited<ReturnType<typeof getAcademy2Management>>;
type Props = { headquartersId: string; kind: Kind; id: string; title: string; disabled?: boolean; children?: ReactNode; showArchived?: boolean; onChanged?: () => void; compact?: boolean; hideState?: boolean };
const labels: Record<string, string> = { duplicate: '複製する', archive: 'アーカイブする', restore: '一覧に戻す', delete: '削除する', unpublish: '非公開にする', republish: '公開条件を確認して再公開', cancel: '開催を中止する' };
const states: Record<string, string> = { saved: '保存済み', draft: '下書き', published: '公開版あり', unpublished: '非公開', not_published: '未公開', unavailable: '非公開', planned: '開催予定', active: '開催中', completed: '開催終了', cancelled: '中止', open: '受付中', closed: '受付停止', ended: '受付終了', archived: 'アーカイブ済み' };
const routes = { course: 'courses', plan: 'offerings', event: 'classes' };

function impact(kind: Kind, action: string) {
  if (action === 'delete') return '完全に削除します。この操作は取り消せません。削除できるかサーバーで再確認します。';
  if (action === 'duplicate') return kind === 'course' ? '講座名・紹介文・メイン画像・参考価格・物品設定を新しい講座にコピーします。教材・追加写真・ライセンス・認定設定と各種履歴は引き継ぎません。複製後に必要な内容を確認してください。' : kind === 'plan' ? '保存済みの設定と販売ページを新しい下書きにコピーします。公開版・申込・決済・同意・発送履歴は引き継ぎません。' : '新しい未公開の開催を作ります。申込・入金・発送・出欠・修了履歴は引き継ぎません。';
  if (action === 'unpublish') return '新しいお客様への表示と申し込みを停止します。既存の申込・入金・受講権・教材・履歴は保持します。';
  if (action === 'republish') return '保存済みの公開版と開催条件を再確認して公開します。編集中の下書きを公開版へ反映する操作ではありません。';
  if (action === 'cancel') return '開催を中止し、新規受付を停止します。既存の申込は保持します。返金・日程変更・申込者への連絡は別途確認してください。自動返金や自動通知は行いません。';
  if (action === 'archive') return '通常一覧から外します。公開・受付状態は変わりません。既存データと履歴は保持します。';
  return 'アーカイブから通常一覧へ戻します。募集を開始する操作ではありません。';
}

/** Actions and delete eligibility are exclusively supplied and rechecked by the server. */
export function AcademyManagementActions({ headquartersId, kind, id, title, disabled = false, children, showArchived = true, onChanged, compact = false, hideState = false }: Props) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const confirmation = useRef<HTMLDialogElement>(null);
  const [pendingAction, setPendingAction] = useState('');
  useEffect(() => {
    let live = true; setLoading(true); setSnapshot(null); setError('');
    getAcademy2Management(headquartersId, kind, id).then(value => { if (live) setSnapshot(value); }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '管理状態を確認できませんでした。'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [headquartersId, kind, id, retry]);

  async function act(action: string, confirmed = false) {
    if (!snapshot || disabled || inFlight.current || !snapshot.allowed_actions.includes(action)) return;
    if (!confirmed) { setPendingAction(action); confirmation.current?.showModal(); return; }
    confirmation.current?.close();
    const signature = `${headquartersId}:${kind}:${id}:${action}:${snapshot.revision}:${snapshot.source_version}`;
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    inFlight.current = true; setBusy(true); setError(''); setMessage('処理中…');
    try {
      const result = await actAcademy2Management(headquartersId, kind, id, action, snapshot.revision, request.current.id, snapshot.source_version);
      request.current = null;
      if (action === 'duplicate') { router.push(toAcademyContextHref(`/academy/${routes[kind]}/${result.id}`, headquartersId, 'manage')); return; }
      if (action === 'delete') { router.push(toAcademyContextHref(`/academy/${routes[kind]}`, headquartersId, 'manage')); router.refresh(); onChanged?.(); return; }
      const verified = await getAcademy2Management(headquartersId, kind, id);
      setSnapshot(verified); setMessage('変更しました'); setMenuOpen(false);
      onChanged?.();
    } catch (cause) { setMessage(''); setError(cause instanceof Error ? cause.message : '変更できませんでした。最新の状態を確認してください。'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const actions = snapshot?.allowed_actions.filter(action => Object.hasOwn(labels, action) && (action !== 'delete' || snapshot.can_delete)) ?? [];
  return <div className={`${children ? styles.item : styles.editor} ${compact ? styles.compact : ''}`} hidden={!!snapshot?.archived && !showArchived}>
    <dialog ref={confirmation} className={styles.confirmation} aria-label="操作の確認"><h3>{labels[pendingAction] ?? '操作の確認'}</h3><p>「{title}」</p><p>{impact(kind,pendingAction)}</p><div><button type="button" onClick={()=>confirmation.current?.close()}>キャンセル</button><button type="button" disabled={busy||disabled} onClick={()=>void act(pendingAction,true)}>実行する</button></div></dialog>
    {children}
    <div className={styles.controls}>
      {loading ? <span role="status">状態を確認中…</span> : snapshot && ((!hideState && (!compact || snapshot.state !== 'saved')) || snapshot.archived) ? <><span className={styles.badge}>{states[snapshot.state] ?? '状態を確認してください'}</span>{snapshot.archived && snapshot.state !== 'archived' && <span className={styles.badge}>アーカイブ済み</span>}</> : null}
      {!!actions.length && <div className={styles.menu}><button type="button" aria-expanded={menuOpen} aria-label={`${title}の操作`} onClick={()=>setMenuOpen(value=>!value)}>{compact ? '…' : '操作'}</button>{menuOpen&&<div className={styles.panel}>{actions.map(action => <button key={action} type="button" className={action === 'delete' || action === 'cancel' ? styles.danger : ''} disabled={disabled || busy || loading} onClick={() => void act(action)}>{labels[action]}</button>)}{!compact && !snapshot?.can_delete && snapshot?.delete_reason && <p>{snapshot.delete_reason}</p>}{disabled && <p>入力中の内容を保存してから操作してください。</p>}</div>}</div>}
      {message && <span role="status">{message}</span>}
      {error && <div className={styles.error} role="alert">{error}<button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>管理状態を再確認</button></div>}
    </div>
  </div>;
}
