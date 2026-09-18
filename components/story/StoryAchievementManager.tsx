"use client";

import { CalendarDays, Eye, EyeOff, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { getMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import {
  listMyStoryAchievements,
  publishMyStoryAchievement,
  StoryAchievementRpcUnavailableError,
  type StoryAchievementDisplayMode,
  type StoryAchievementPublicationStatus,
  type StoryAchievementSummary,
  withdrawMyStoryAchievement
} from "@/lib/story/achievement-management";
import { supabase } from "@/lib/supabase/client";

type ProfileState = "missing" | "draft" | "published";

const statusLabels: Record<StoryAchievementPublicationStatus, string> = {
  draft: "下書き",
  published: "公開設定済み",
  withdrawn: "取り下げ済み"
};

const modeLabels: Record<StoryAchievementDisplayMode, string> = {
  count_only: "実績数だけ",
  card_only: "活動実績カードだけ",
  card_and_count: "実績数とカード"
};

export function StoryAchievementManager() {
  const { user } = useAuth();
  const [profileState, setProfileState] = useState<ProfileState>("missing");
  const [items, setItems] = useState<StoryAchievementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [rpcUnavailable, setRpcUnavailable] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [actingId, setActingId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");
      setIsError(false);
      const [profileResult, achievementResult] = await Promise.allSettled([
        getMyStoryProfile(supabase),
        listMyStoryAchievements(supabase)
      ]);
      if (cancelled) return;

      if (profileResult.status === "fulfilled") {
        setProfileState(profileResult.value ? (profileResult.value.isPublished ? "published" : "draft") : "missing");
      } else {
        setProfileState("missing");
        setIsError(true);
        setMessage("STORYプロフィールの状態を確認できませんでした。時間をおいて読み込み直してください。");
      }

      if (achievementResult.status === "fulfilled") {
        setItems(achievementResult.value);
        setRpcUnavailable(false);
      } else if (achievementResult.reason instanceof StoryAchievementRpcUnavailableError) {
        setItems([]);
        setRpcUnavailable(true);
      } else {
        setItems([]);
        setIsError(true);
        setMessage("連携実績を読み込めませんでした。通信状態を確認して、もう一度お試しください。");
      }
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [user.id]);

  async function changePublication(item: StoryAchievementSummary) {
    setActingId(item.achievementId);
    setMessage("");
    setIsError(false);
    try {
      const updated = item.publicationStatus === "published"
        ? await withdrawMyStoryAchievement(supabase, item.achievementId)
        : await publishMyStoryAchievement(supabase, item.achievementId);
      setItems((current) => current.map((candidate) => candidate.achievementId === updated.achievementId ? updated : candidate));
      setMessage(updated.publicationStatus === "published" ? "実績を公開設定にしました。" : "実績を取り下げました。");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof StoryAchievementRpcUnavailableError
        ? "実績の公開機能は準備中です。"
        : "実績の状態を変更できませんでした。内容を確認して、もう一度お試しください。");
    } finally {
      setActingId("");
    }
  }

  if (loading) return <div className="mx-auto min-h-64 w-full max-w-[680px] animate-pulse rounded-[24px] border border-black/10 bg-white" />;

  return (
    <main className="mx-auto w-full max-w-[680px] space-y-4 text-[#171821]">
      <ProfileNotice state={profileState} />

      {message ? (
        <p role={isError ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-sm font-bold leading-6 ${isError ? "bg-[var(--mikke-pink)] text-black/70" : "bg-[var(--mikke-green)] text-black/70"}`}>
          {message}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-black/10 bg-white">
        <header className="border-b border-black/5 px-5 py-5">
          <p className="text-[10px] font-bold tracking-[0.18em] text-[var(--mikke-blue)]">MY ACTIVITIES</p>
          <h1 className="mt-1 text-xl font-extrabold">連携した活動実績</h1>
          <p className="mt-2 text-xs leading-5 text-black/50">MarketNoteから自分で追加した公開用の内容だけを確認できます。</p>
        </header>

        {rpcUnavailable ? (
          <EmptyState title="連携機能を準備しています" description="安全な本人確認の仕組みを確認中です。準備が整うまで、ここには実績を表示しません。" />
        ) : items.length === 0 ? (
          <EmptyState title="連携した実績はまだありません" description="MarketNoteで終了日を過ぎた予定から「+STORY」を選ぶと、ここで公開内容を確認できます。" />
        ) : (
          <div className="divide-y divide-black/5">
            {items.map((item) => (
              <AchievementRow key={item.achievementId} item={item} busy={actingId === item.achievementId} onChange={() => void changePublication(item)} />
            ))}
          </div>
        )}
      </section>

      <p className="px-2 text-center text-[11px] leading-5 text-black/40">公開プロフィール内でのカード配置と並び替えは、次の段階で追加します。</p>
    </main>
  );
}

function ProfileNotice({ state }: { state: ProfileState }) {
  if (state === "missing") {
    return (
      <section className="rounded-[20px] border border-black/10 bg-[var(--mikke-yellow)] px-5 py-4">
        <p className="text-sm font-extrabold">最初にSTORYをつくってください</p>
        <p className="mt-1 text-xs leading-5 text-black/60">プロフィールを作ると、MarketNoteから追加した実績を自分で管理できます。</p>
        <Link href="/story/start?next=/story/achievements" className="mt-3 inline-flex rounded-full bg-[var(--mikke-blue)] px-4 py-2 text-xs font-bold text-white">STORYをつくる</Link>
      </section>
    );
  }

  if (state === "draft") {
    return (
      <section className="rounded-[20px] border border-black/10 bg-[var(--mikke-yellow)] px-5 py-4">
        <p className="text-sm font-extrabold">プロフィールはまだ公開されていません</p>
        <p className="mt-1 text-xs leading-5 text-black/60">実績の公開状態は準備できますが、プロフィールを公開するまで外からは見えません。</p>
        <Link href="/story/edit" className="mt-3 inline-flex rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold">プロフィールを確認する</Link>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] border border-black/10 bg-[var(--mikke-green)] px-5 py-4">
      <p className="text-sm font-extrabold">STORYプロフィールは公開中です</p>
      <p className="mt-1 text-xs leading-5 text-black/60">ここでは実績の公開状態を管理できます。公開プロフィールへの配置は現在準備中です。</p>
    </section>
  );
}

function AchievementRow({ item, busy, onChange }: { item: StoryAchievementSummary; busy: boolean; onChange: () => void }) {
  const isPublished = item.publicationStatus === "published";
  const isCountOnly = item.displayMode === "count_only";

  return (
    <article className="px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={item.publicationStatus} />
        <span className="rounded-full bg-black/[0.04] px-3 py-1 text-[10px] font-bold text-black/55">{modeLabels[item.displayMode]}</span>
      </div>

      {isCountOnly ? (
        <div className="mt-4 rounded-2xl bg-black/[0.025] px-4 py-4">
          <p className="text-sm font-extrabold">実績数だけに加える設定</p>
          <p className="mt-1 text-xs leading-5 text-black/45">予定名・場所・写真・メモなどの個別情報は表示しません。</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--mikke-blue)]">{item.publicTypeLabel || "活動実績"}</p>
          <h2 className="mt-1 text-lg font-extrabold leading-7">{item.publicTitle}</h2>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-black/50">
            {item.occurredOn ? <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{formatStoryDate(item.occurredOn)}</span> : null}
            {item.publicLocation ? <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{item.publicLocation}</span> : null}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" disabled={busy} onClick={onChange} className={`inline-flex min-w-32 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-50 ${isPublished ? "border border-black/10 bg-white" : "bg-[var(--mikke-orange)] text-white"}`}>
          {busy ? <RefreshCw size={14} className="animate-spin" /> : isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
          {busy ? "変更中" : isPublished ? "取り下げる" : item.publicationStatus === "withdrawn" ? "再掲載する" : "公開する"}
        </button>
      </div>
    </article>
  );
}

function StatusChip({ status }: { status: StoryAchievementPublicationStatus }) {
  const color = status === "published" ? "bg-[var(--mikke-green)]" : status === "draft" ? "bg-[var(--mikke-yellow)]" : "bg-[var(--mikke-pink)]";
  return <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${color}`}>{statusLabels[status]}</span>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="px-5 py-12 text-center"><p className="text-sm font-extrabold">{title}</p><p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-black/45">{description}</p></div>;
}

function formatStoryDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${year}/${month}/${day}`;
}
