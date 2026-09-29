"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { getCoursePublicationAccess, publishSavedCourse, publishFirstSavedCourse, type CoursePublicationAccess } from "@/lib/academy/course-publication";
import { AcademyFirstPublicationPanel } from "./AcademyFirstPublicationPanel";
import { getCourse } from "@/lib/academy/courses";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import type { AcademyCourse, Profile } from "@/types/database";

export function AcademySavedCoursePublication({ profile, course, dirty, onChanged, onBusy }: {
  profile: Profile; course: AcademyCourse; dirty: boolean;
  onChanged: (course: AcademyCourse) => void; onBusy: (busy: boolean) => void;
}) {
  const [access, setAccess] = useState<CoursePublicationAccess | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const lifetime = useRef({ mounted: true, generation: 0, authenticated: false });
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    const life = lifetime.current;
    life.mounted = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const valid = session?.user.id === profile.user_id;
      if (!life.mounted) return;
      if (life.authenticated !== valid) {
        life.generation++; life.authenticated = valid;
        setAuthenticated(valid); setConfirmed(false);
        lock.current = false; setBusy(false); onBusy(false);
        setAttempt(value => value + 1);
      }
    });
    return () => { life.mounted = false; life.generation++; life.authenticated = false; data.subscription.unsubscribe(); };
  }, [profile.user_id, course.headquarters_id, course.id, onBusy]);
  useEffect(() => {
    let active = true;
    setAccess(null); setError(""); setConfirmed(false);
    getCoursePublicationAccess(profile, course.headquarters_id).then(value => { if (active) setAccess(value); })
      .catch(() => { if (active) setError("公開できる利用状態を確認できませんでした。時間をおいて再確認してください。"); });
    return () => { active = false; };
  }, [profile.user_id, course.headquarters_id, attempt]);
  useEffect(() => { setConfirmed(false); }, [dirty, course]);
  async function firstPublish() {
    if (lock.current || !authenticated || dirty || !access || access.route !== "first") throw new Error("公開前に状態を確認してください。");
    const generation = lifetime.current.generation;
    const isCurrent = () => lifetime.current.mounted && lifetime.current.authenticated && lifetime.current.generation === generation;
    lock.current = true; setBusy(true); onBusy(true); setError(""); setNotice("");
    try {
      const result = await publishFirstSavedCourse(profile, course.headquarters_id, course.id, access.status, isCurrent);
      if (!isCurrent()) throw new Error("操作するアカウントが変わりました。");
      onChanged(result.course); setNotice(result.warning || "講座を公開しました。サービスの公開はサービス編集で行ってください。");
      setAttempt(value => value + 1);
    } finally {
      if (isCurrent()) { lock.current = false; setBusy(false); onBusy(false); }
    }
  }
  async function publish() {
    if (lock.current || !authenticated || dirty || !confirmed || !access || access.route === "blocked") return;
    const generation = lifetime.current.generation;
    const isCurrent = () => lifetime.current.mounted && lifetime.current.authenticated && lifetime.current.generation === generation;
    lock.current = true; setBusy(true); onBusy(true); setError(""); setNotice("");
    try {
      const result = await publishSavedCourse(profile, course.headquarters_id, course.id, isCurrent);
      if (!isCurrent()) return;
      onChanged(result.course); setNotice(result.warning || "講座を公開しました。サービスの公開はサービス編集で行ってください。");
    } catch (cause) { if (isCurrent()) { setError(cause instanceof Error ? cause.message : "公開状態を確認できませんでした。"); setAccess(null); } }
    finally { if (isCurrent()) { lock.current = false; setBusy(false); onBusy(false); setConfirmed(false); } }
  }
  return <section id="course-publication" className="mt-6 scroll-mt-24 space-y-3 rounded-xl border border-[var(--mikke-line)] p-5">
    <h2 className="font-bold">講座の公開</h2>
    <p>現在：{course.is_published ? "公開済み" : "非公開"}</p>
    <p className="text-sm">公開すると、保存済みの講座情報が教室ホームページなどに表示され、サービスで使えるようになります。教材の閲覧権限やサービスの申込受付は別の設定です。</p>
    {access?.route === "legacy" && <p className="text-sm">講座名を含む公開実績の記録も作成します。</p>}
    {access && <p className="text-sm">{access.message}</p>}
    {!access && !error && <p className="text-sm">利用状態を確認しています…</p>}
    {dirty && <p className="text-sm">変更を保存してから公開してください。</p>}
    {!authenticated && <p className="text-sm">公開前にログイン状態を確認しています。</p>}
    {error && <p role="alert" className="text-sm">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {!course.is_published && access?.route === "first" && <>
      <p className="text-sm">見積もりの有効期限は30分です。期限を過ぎた場合は本部設定で料金と支払方法を確認し直してください。</p>
      <AcademyFirstPublicationPanel identityKey={profile.user_id} state={access.status} access={access.access} course={course}
        allowedActions={authenticated && !dirty && !busy ? ["publish"] : []}
        onAction={async action => { if (action !== "publish") throw new Error("unsupported_publication_action"); await firstPublish(); }}
        onRefresh={async () => {
          const generation = lifetime.current.generation;
          const next = await getCoursePublicationAccess(profile, course.headquarters_id);
          const saved = await getCourse(course.headquarters_id, course.id);
          if (!lifetime.current.mounted || !lifetime.current.authenticated || lifetime.current.generation !== generation) throw new Error("identity_changed");
          if (saved.id !== course.id || saved.headquarters_id !== course.headquarters_id) throw new Error("course_scope_changed");
          // Re-reading a publication receipt must never overwrite unsaved form content.
          if (saved.is_published !== course.is_published) onChanged({ ...course, is_published: saved.is_published });
          setAccess(next);
        }} />
    </>}
    {!course.is_published && access?.route !== "first" && <>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={!authenticated || dirty || busy || !access || access.route === "blocked"} onChange={event => setConfirmed(event.target.checked)} />保存済みの講座情報を公開することを確認しました</label>
      <button type="button" disabled={!authenticated || dirty || busy || !confirmed || !access || access.route === "blocked"} onClick={publish} className="min-h-11 rounded-lg bg-[var(--mikke-primary)] px-4 text-white disabled:opacity-50">{busy ? "公開中…" : "講座を公開する"}</button>
    </>}
    <div className="flex flex-wrap gap-3 text-sm"><button type="button" disabled={busy} onClick={() => setAttempt(value => value + 1)} className="min-h-11 underline">利用状態を再確認</button><Link className="inline-flex min-h-11 items-center underline" href={toCurrentAcademyContextHref("/academy/settings")}>本部設定を確認</Link></div>
  </section>;
}
