"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "@/components/team-works/projects/TeamWorksProjectsShell";
import { supabase } from "@/lib/supabase/client";
import {
  loadMyOperationsClientProfile,
  loadMyOperationsPartnerProfile,
  updateMyOperationsClientProfile,
  updateMyOperationsPartnerProfile
} from "@/lib/team-works-operations-project";

export function TeamWorksPartnerSelfProfile() {
  const [form, setForm] = useState({ displayName: "", email: "", phone: "", address: "", skills: "", bio: "" });
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
    const profile = await loadMyOperationsPartnerProfile(supabase);
    if (!profile) return;
    setAvailable(true);
    setForm({
      displayName: profile.displayName,
      email: profile.email,
      phone: profile.phone ?? "",
      address: profile.address ?? "",
      skills: profile.skills ?? "",
      bio: profile.bio ?? ""
    });
  }, []);
  useEffect(() => { void load().catch(() => undefined); }, [load]);
  if (!available) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateMyOperationsPartnerProfile(supabase, form);
      setMessageKind("success");
      setMessage("パートナー情報を保存しました。本部の名簿にも反映されます。");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "パートナー情報を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MikkeSection title="パートナー情報" tone="editorial">
      <p className="-mt-2 mb-3 text-xs leading-6 text-[var(--mikke-muted)]">本部へ共有する連絡先・スキル・自己紹介です。</p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <TeamWorksProjectField label="名前" required><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="メールアドレス"><input value={form.email} readOnly className={`${teamWorksProjectInputClass} bg-[var(--mikke-surface-soft)]`} /></TeamWorksProjectField>
        <TeamWorksProjectField label="電話番号"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="住所"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="スキル"><textarea rows={3} value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="自己紹介"><textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button disabled={saving || !form.displayName.trim()} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? "保存中…" : "パートナー情報を保存"}</button>
          {message ? <SaveResult kind={messageKind} message={message} /> : null}
        </div>
      </form>
    </MikkeSection>
  );
}

export function TeamWorksClientSelfProfile() {
  const [form, setForm] = useState({ companyName: "", contactName: "", department: "", email: "", phone: "", address: "" });
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
    const profile = await loadMyOperationsClientProfile(supabase);
    if (!profile) return;
    setAvailable(true);
    setForm({
      companyName: profile.companyName,
      contactName: profile.contactName ?? "",
      department: profile.department ?? "",
      email: profile.email,
      phone: profile.phone ?? "",
      address: profile.address ?? ""
    });
  }, []);
  useEffect(() => { void load().catch(() => undefined); }, [load]);
  if (!available) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateMyOperationsClientProfile(supabase, form);
      setMessageKind("success");
      setMessage("企業・担当者情報を保存しました。本部の名簿にも反映されます。");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "企業情報を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MikkeSection title="企業・担当者情報" tone="editorial">
      <p className="-mt-2 mb-3 text-xs leading-6 text-[var(--mikke-muted)]">本部へ共有する企業情報です。請求先名・請求先メールは請求書機能の段階で追加します。</p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <TeamWorksProjectField label="企業名" required><input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="担当者"><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="部署"><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="メールアドレス"><input value={form.email} readOnly className={`${teamWorksProjectInputClass} bg-[var(--mikke-surface-soft)]`} /></TeamWorksProjectField>
        <TeamWorksProjectField label="電話番号"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="住所"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button disabled={saving || !form.companyName.trim()} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving ? "保存中…" : "企業情報を保存"}</button>
          {message ? <SaveResult kind={messageKind} message={message} /> : null}
        </div>
      </form>
    </MikkeSection>
  );
}

function SaveResult({ kind, message }: { kind: "success" | "error"; message: string }) {
  const Icon = kind === "success" ? CheckCircle2 : CircleAlert;
  return (
    <span
      role={kind === "success" ? "status" : "alert"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
        kind === "success"
          ? "bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]"
          : "border border-[var(--mikke-danger)] text-[var(--mikke-danger)]"
      }`}
    >
      <Icon size={15} /> {message}
    </span>
  );
}
