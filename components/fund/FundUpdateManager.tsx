"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatDate } from "@/lib/format";
import { useFundProjects } from "@/lib/fund/store";
import type { FundUpdateVisibility } from "@/lib/fund/types";
import { isValidFundExternalUrl, normalizeFundExternalUrl } from "@/lib/fund/url";

export function FundUpdateManager({ projectId }: { projectId: string }) {
  const { profile } = useAuth();
  const { updates, createUpdate, updateFundUpdate } = useFundProjects(profile.id);
  const projectUpdates = updates.filter((update) => update.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [visibility, setVisibility] = useState<FundUpdateVisibility>("draft");
  const validImage = isValidFundExternalUrl(imageUrl);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || !validImage) return;
    createUpdate({ projectId, title: title.trim(), body: body.trim(), imageUrl: normalizeFundExternalUrl(imageUrl), visibility });
    setTitle(""); setBody(""); setImageUrl(""); setVisibility("draft");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <MikkeSection title="活動報告を書く">
        <form onSubmit={submit} className="space-y-3">
          <Field label="タイトル"><input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} required /></Field>
          <Field label="本文"><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} className={`${inputClass} resize-none`} required /></Field>
          <Field label="画像URL（任意）"><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field>
          {!validImage ? <p className="text-xs font-bold text-[var(--mikke-danger)]">画像URLはhttp/httpsで入力してください。</p> : null}
          <Field label="公開状態">
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as FundUpdateVisibility)} className={inputClass}><option value="draft">下書き</option><option value="public">公開</option></select>
          </Field>
          <button type="submit" disabled={!title.trim() || !body.trim() || !validImage} className="w-full rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">活動報告を保存</button>
        </form>
      </MikkeSection>

      <MikkeSection title="活動報告一覧">
        {projectUpdates.length > 0 ? <div className="divide-y divide-[var(--mikke-line)]">{projectUpdates.map((update) => (
          <article key={update.id} className="py-4 first:pt-0">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{update.title}</h3><p className="mt-1 text-xs text-[var(--mikke-muted)]">{formatDate(update.publishedAt ?? update.createdAt)}</p></div><MikkeStatusBadge tone={update.visibility === "public" ? "success" : "muted"} className="px-2 py-1">{update.visibility === "public" ? "公開" : "下書き"}</MikkeStatusBadge></div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text-soft)]">{update.body}</p>
            <button type="button" onClick={() => updateFundUpdate(update.id, { visibility: update.visibility === "public" ? "draft" : "public" })} className="mt-3 text-xs font-bold text-[var(--mikke-primary)]">{update.visibility === "public" ? "下書きに戻す" : "公開する"}</button>
          </article>
        ))}</div> : <MikkeEmptyState title="活動報告はまだありません" helper="進んだことを少しずつ残せます。" />}
      </MikkeSection>
    </div>
  );
}

const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-xs font-bold">{label}</span>{children}</label>; }
