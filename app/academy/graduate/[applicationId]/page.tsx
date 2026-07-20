"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { getPublicCourse } from "@/lib/academy/lp";
import { getInstructorPageForViewer } from "@/lib/academy/instructor-page";
import { PageBlocks } from "@/components/academy/PageBlocks";
import {
  findMyApplicationsByEmail,
  getMyApplicationById,
  registerAsInstructorFromGraduation,
  setCommunityInterest
} from "@/lib/academy/graduate";
import type { AcademyApplication, AcademyCourse, AcademyInstructorPage } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

// Wave E (AC-E7): 受講後の任意講師登録・community参加フロー。
// 申込時メールでログイン済み前提（RLSは user_id=auth.uid() の行だけを返す）。
// メールが一致しない場合のフォールバック検索も、常にRLSの範囲＝自分の行だけで完結する。
function GraduateContent({ applicationId }: { applicationId: string }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<AcademyApplication | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [page, setPage] = useState<AcademyInstructorPage | null>(null);

  const [fallbackEmail, setFallbackEmail] = useState("");
  const [fallbackSearching, setFallbackSearching] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [instructorChecked, setInstructorChecked] = useState(false);
  const [instructorSaving, setInstructorSaving] = useState(false);
  const [instructorDone, setInstructorDone] = useState(false);
  const [instructorError, setInstructorError] = useState<string | null>(null);
  const [communitySaving, setCommunitySaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const found = await getMyApplicationById(applicationId).catch(() => null);
      const myEmail = (user.email ?? "").trim().toLowerCase();
      if (found && (found.applicant_email ?? "").trim().toLowerCase() === myEmail) {
        setApplication(found);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }
    load();
  }, [applicationId, user.email]);

  useEffect(() => {
    if (!application) return;
    let mounted = true;
    Promise.all([
      getPublicCourse(application.course_id).catch(() => null),
      getInstructorPageForViewer(application.course_id).catch(() => null)
    ]).then(([c, p]) => {
      if (!mounted) return;
      setCourse(c);
      setPage(p);
    });
    return () => {
      mounted = false;
    };
  }, [application]);

  async function handleFallbackSearch(e: React.FormEvent) {
    e.preventDefault();
    setFallbackError(null);
    if (!fallbackEmail.trim()) return setFallbackError("メールアドレスを入力してください。");
    setFallbackSearching(true);
    try {
      const found = await findMyApplicationsByEmail(fallbackEmail);
      const match = found.find((a) => a.id === applicationId);
      if (!match) {
        setFallbackError("該当する申込が見つかりませんでした。入力したメールアドレスをご確認ください。");
        return;
      }
      setApplication(match);
      setNotFound(false);
    } finally {
      setFallbackSearching(false);
    }
  }

  async function handleRegisterInstructor() {
    if (!application) return;
    setInstructorSaving(true);
    setInstructorError(null);
    try {
      await registerAsInstructorFromGraduation(profile, application);
      setInstructorDone(true);
    } catch (err) {
      setInstructorError(err instanceof Error ? err.message : "登録に失敗しました。すでに登録済みの可能性があります。");
    } finally {
      setInstructorSaving(false);
    }
  }

  async function handleToggleCommunity(next: boolean) {
    if (!application) return;
    setCommunitySaving(true);
    try {
      const updated = await setCommunityInterest(application.id, next);
      setApplication(updated);
    } finally {
      setCommunitySaving(false);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  if (!application || notFound) {
    return (
      <div className="mx-auto max-w-md px-5 py-10">
        <p className="text-sm font-bold text-[var(--mikke-text)]">お申込み時のメールアドレスでログインしてください</p>
        <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">
          現在ログイン中のメールアドレス（{user.email ?? "不明"}）では、この申込を確認できませんでした。
        </p>
        <form onSubmit={handleFallbackSearch} className="mt-4 space-y-2">
          <label className={labelClass}>申込時と異なるメールアドレスでお申込みの場合はこちら</label>
          <input
            type="email"
            className={inputClass}
            value={fallbackEmail}
            onChange={(e) => setFallbackEmail(e.target.value)}
            placeholder="申込時に入力したメールアドレス"
          />
          <button
            type="submit"
            disabled={fallbackSearching}
            className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {fallbackSearching ? "検索中…" : "この内容で申込を探す"}
          </button>
          {fallbackError ? <p className="text-xs font-bold text-[var(--mikke-danger)]">{fallbackError}</p> : null}
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-5 py-8">
      <div>
        {course ? <p className="text-xs font-bold tracking-widest text-[var(--mikke-accent-strong)]">{course.code}</p> : null}
        <h1 className="mt-1 text-lg font-bold text-[var(--mikke-text)]">{course?.name ?? "講座"} 受講後のご案内</h1>
        <p className="mt-1 text-xs text-[var(--mikke-muted)]">{application.applicant_name}さん、ご受講ありがとうございました。</p>
      </div>

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <h2 className="text-sm font-bold text-[var(--mikke-text)]">復習コンテンツ</h2>
        {page?.blocks.length ? (
          <div className="mt-3">
            <PageBlocks blocks={page.blocks} />
          </div>
        ) : (
          <div className="mt-3 text-xs leading-5 text-[var(--mikke-muted)]">
            <p>復習ページは準備中です。基本情報のみ表示しています。</p>
            {course?.description ? <p className="mt-2 whitespace-pre-wrap">{course.description}</p> : null}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <h2 className="text-sm font-bold text-[var(--mikke-text)]">受講後の任意フロー（どちらも任意です）</h2>

        <div className="rounded-xl border border-[var(--mikke-line)] p-3">
          <label className="flex items-center gap-2 text-sm font-bold text-[var(--mikke-text)]">
            <input
              type="checkbox"
              checked={instructorChecked || instructorDone}
              disabled={instructorDone}
              onChange={(e) => setInstructorChecked(e.target.checked)}
            />
            認定講師登録する
          </label>
          <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">
            チェックして登録すると、営業用URLが発行され、本部の認定講師一覧・講座の営業ページに掲載されます。
          </p>
          {instructorDone ? (
            <p className="mt-2 text-xs font-bold text-[var(--mikke-success)]">
              講師登録が完了しました。
              <Link href="/academy/portal" className="ml-1 underline">
                講師ポータルへ
              </Link>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleRegisterInstructor}
              disabled={!instructorChecked || instructorSaving}
              className="mt-2 rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {instructorSaving ? "登録中…" : "この内容で認定講師登録する"}
            </button>
          )}
          {instructorError ? <p className="mt-1 text-xs font-bold text-[var(--mikke-danger)]">{instructorError}</p> : null}
        </div>

        <div className="rounded-xl border border-[var(--mikke-line)] p-3">
          <label className="flex items-center gap-2 text-sm font-bold text-[var(--mikke-text)]">
            <input
              type="checkbox"
              checked={application.community_interest}
              disabled={communitySaving}
              onChange={(e) => handleToggleCommunity(e.target.checked)}
            />
            communityに参加する
          </label>
          <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">
            参加ご希望として記録するだけです（community本体は準備中のため、ご案内は追ってお送りします）。
          </p>
        </div>
      </section>
    </div>
  );
}

export default function GraduatePage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = use(params);
  return (
    <AuthGate>
      <main className="min-h-screen bg-[var(--mikke-surface-soft)]">
        <p className="mx-auto max-w-lg px-5 pt-6 text-[11px] leading-5 text-[var(--mikke-muted)]">
          この画面は、お申込み時と同じメールアドレスでログインしてご利用ください。
        </p>
        <GraduateContent applicationId={applicationId} />
      </main>
    </AuthGate>
  );
}
