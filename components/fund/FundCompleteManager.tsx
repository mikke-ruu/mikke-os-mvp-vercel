"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { createFundCompletedActivity } from "@/lib/fund/activity";
import { notifyFundDatabaseUpdated, saveFundCompletion } from "@/lib/fund/database";
import {
  fundTargetServiceLabels,
  type FundAppLink,
  type FundChallengeRecord,
  type FundProject,
  type FundTargetService
} from "@/lib/fund/types";
import { isValidFundExternalUrl, normalizeFundExternalUrl } from "@/lib/fund/url";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";
import { getAppPath } from "@/lib/mikkeos/routes";

const targetServices = Object.keys(fundTargetServiceLabels) as FundTargetService[];

export function FundCompleteManager({
  project,
  challengeRecords,
  appLinks
}: {
  project: FundProject;
  challengeRecords: FundChallengeRecord[];
  appLinks: FundAppLink[];
}) {
  const { profile } = useAuth();
  const { addLog } = useUnifiedActivityLogs();
  const existingRecord = challengeRecords.find((record) => record.projectId === project.id);
  const [title, setTitle] = useState(`${project.title}を実現しました`);
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [storyEnabled, setStoryEnabled] = useState(false);
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().slice(0, 10));
  const [targets, setTargets] = useState<FundTargetService[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const projectCanBeShared = project.visibility === "public" && project.status !== "draft";

  useEffect(() => {
    if (initialized) return;
    const savedTargets = appLinks.filter((link) => link.projectId === project.id && (link.linkStatus === "ready" || link.linkStatus === "linked"));
    if (existingRecord) {
      setTitle(existingRecord.title);
      setSummary(existingRecord.summary);
      setOutcome(existingRecord.outcome);
      setImageUrl(existingRecord.imageUrl);
      setVisibility(existingRecord.visibility);
      setStoryEnabled(existingRecord.storyEnabled);
      setCompletedAt(existingRecord.completedAt.slice(0, 10));
    }
    setTargets(savedTargets.map((link) => link.targetService));
    setInitialized(true);
  }, [appLinks, challengeRecords, existingRecord, initialized, project.id]);

  function toggleTarget(target: FundTargetService) {
    setTargets((current) => current.includes(target) ? current.filter((item) => item !== target) : [...current, target]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !summary.trim() || !isValidFundExternalUrl(imageUrl)) return;
    setSaving(true);
    setMessage("");
    const completedProject = { ...project, stage: "realization" as const, status: "completed" as const };
    const timestamp = new Date().toISOString();
    const record: FundChallengeRecord = {
      id: existingRecord?.id ?? `fund_challenge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId: project.id,
      title: title.trim(),
      summary: summary.trim(),
      outcome: outcome.trim(),
      imageUrl: normalizeFundExternalUrl(imageUrl),
      visibility,
      storyEnabled: visibility === "public" && projectCanBeShared && storyEnabled,
      completedAt,
      publishedAt: visibility === "public" ? existingRecord?.publishedAt ?? timestamp : null,
      createdAt: existingRecord?.createdAt ?? timestamp,
      updatedAt: timestamp
    };

    try {
      await saveFundCompletion({
        ownerProfileId: profile.id,
        projectId: project.id,
        record,
        targets
      });
      notifyFundDatabaseUpdated(profile.id);
      addLog(createFundCompletedActivity(completedProject, record));
      setMessage("挑戦の軌跡を保存しました。");
    } catch {
      setMessage("保存できませんでした。時間をおいて、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  const savedLinks = appLinks.filter((link) => link.projectId === project.id && (link.linkStatus === "ready" || link.linkStatus === "linked"));

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl">
      <MikkeSection title="挑戦の軌跡">
        <div className="grid gap-4">
          <Field label="タイトル"><input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} required /></Field>
          <Field label="何を実現できましたか？"><textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} className={`${inputClass} resize-none`} required /></Field>
          <Field label="生まれた変化・次につながること"><textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} rows={4} className={`${inputClass} resize-none`} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="完了日"><input value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} type="date" className={inputClass} /></Field>
            <Field label="画像URL（任意）"><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field>
            <Field label="Fundでの公開範囲">
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "public")} className={inputClass}>
                <option value="private">非公開</option><option value="public">公開</option>
              </select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
              <input type="checkbox" checked={storyEnabled} disabled={visibility !== "public" || !projectCanBeShared} onChange={(event) => setStoryEnabled(event.target.checked)} />
              Storyに小さな入口を表示
            </label>
          </div>
          <p className="text-xs leading-5 text-[var(--mikke-muted)]">Storyには本文を複製せず、この挑戦の軌跡へのリンクだけを表示します。金額や応援者情報は表示しません。</p>
          {!projectCanBeShared ? <p className="text-xs font-bold text-[var(--mikke-primary)]">Fund本体を公開すると、Story表示を選べます。限定公開の内容はStoryへ広げません。</p> : null}
        </div>
      </MikkeSection>

      <MikkeSection title="次に使うアプリ">
        <div className="grid gap-2 sm:grid-cols-2">
          {targetServices.map((target) => (
            <label key={target} className="flex items-start gap-3 rounded-lg border border-[var(--mikke-line)] p-3">
              <input type="checkbox" checked={targets.includes(target)} onChange={() => toggleTarget(target)} className="mt-1" />
              <span><span className="block text-sm font-bold">{fundTargetServiceLabels[target].name}</span><span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">{fundTargetServiceLabels[target].helper}</span></span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--mikke-muted)]">ここでは引き継ぎ候補だけを保存します。選んだアプリのデータは自動作成されません。</p>
      </MikkeSection>

      {message ? <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-success)]"><CheckCircle2 size={17} />{message}</p> : null}
      <button type="submit" disabled={!title.trim() || !summary.trim() || !isValidFundExternalUrl(imageUrl) || saving} className="w-full rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "保存中…" : "完成記録を保存"}</button>

      {savedLinks.length > 0 ? (
        <div className="mt-6 border-t border-[var(--mikke-line)] pt-5">
          <p className="text-sm font-bold">引き継ぎ候補</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {savedLinks.map((link) => (
              <Link key={link.id} href={getAppPath(link.targetService)} className="flex items-center gap-3 rounded-lg border border-[var(--mikke-line)] p-3 text-sm font-bold text-[var(--mikke-primary)]">
                <MikkeStatusBadge tone="muted" className="px-2 py-1">候補</MikkeStatusBadge>
                {fundTargetServiceLabels[link.targetService].name}<ArrowRight className="ml-auto" size={16} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}

const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-xs font-bold">{label}</span>{children}</label>; }
