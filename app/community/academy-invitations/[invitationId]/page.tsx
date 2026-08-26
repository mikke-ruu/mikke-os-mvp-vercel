"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { CheckCircle2, DoorOpen, GraduationCap, ShieldCheck } from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import {
  acceptCommunityAcademyAccessInvitation,
  getMyCommunityAcademyAccessInvitation
} from "@/lib/community/client";
import type { CommunityAcademyAccessInvitation } from "@/lib/community/types";
import { supabase } from "@/lib/supabase/client";

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

const previewInvitation: CommunityAcademyAccessInvitation = {
  id: "preview",
  status: "pending",
  academyRole: "learner",
  startsAt: "2026-08-26T00:00:00+09:00",
  endsAt: "2027-08-25T23:59:59+09:00",
  expiresAt: null,
  community: {
    id: "preview-community",
    slug: "sample-academy-community",
    name: "認定講座サポートCommunity",
    description: "受講者向けの質問・交流スペースです。",
    logoUrl: null
  },
  access: {
    entitlementKey: "academy-basic-learner",
    name: "受講者サポートRoom",
    description: "このAcademyの受講期間中に利用できる範囲です。",
    rooms: [
      { id: "room-1", title: "受講者からの質問", description: "講座内容について質問できます。" },
      { id: "room-2", title: "受講者のお知らせ", description: "本部からのお知らせを確認できます。" }
    ]
  },
  consent: {
    requireLegalName: false,
    requirePhone: false,
    requireJoinReason: false,
    termsVersion: 1,
    termsText: "Community利用規約のサンプルです。",
    rulesVersion: 1,
    rulesText: "お互いを尊重してご利用ください。",
    privacyVersion: 1,
    privacyText: "参加に必要な情報だけをCommunity運営者と共有します。"
  },
  hasNormalCommunityAccess: false
};

function InvitationContent({ invitationId, preview }: { invitationId: string; preview: boolean }) {
  const { profile } = useAuth();
  const [invitation, setInvitation] = useState<CommunityAcademyAccessInvitation | null>(preview ? previewInvitation : null);
  const [loading, setLoading] = useState(!preview);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ displayName: profile.display_name ?? "", legalName: "", phone: "", joinReason: "" });
  const [consent, setConsent] = useState({ terms: false, rules: false, privacy: false });

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    getMyCommunityAcademyAccessInvitation(supabase, invitationId)
      .then((data) => {
        if (!active) return;
        setInvitation(data);
        if (!data) setMessage("この招待は見つからないか、現在のアカウント宛てではありません。");
      })
      .catch(() => {
        if (active) setMessage("招待内容を読み込めませんでした。時間をおいてもう一度お試しください。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [invitationId, preview]);

  const canAccept = useMemo(() => {
    if (!invitation || invitation.status !== "pending" || !form.displayName.trim()) return false;
    if (invitation.consent.requireLegalName && !form.legalName.trim()) return false;
    if (invitation.consent.requirePhone && !form.phone.trim()) return false;
    if (invitation.consent.requireJoinReason && !form.joinReason.trim()) return false;
    return consent.terms && consent.rules && consent.privacy;
  }, [consent, form, invitation]);

  async function accept() {
    if (!invitation || !canAccept || preview) return;
    setBusy(true);
    setMessage("");
    try {
      await acceptCommunityAcademyAccessInvitation(supabase, {
        invitationId: invitation.id,
        displayName: form.displayName,
        legalName: form.legalName,
        phone: form.phone,
        joinReason: form.joinReason
      });
      setAccepted(true);
    } catch {
      setMessage("参加手続きを完了できませんでした。招待期限とCommunityの利用状態をご確認ください。");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="py-20 text-center text-sm font-bold">招待内容を確認しています…</p>;
  if (!invitation) return <p className="mx-auto mt-16 max-w-lg rounded-2xl border bg-white p-6 text-center text-sm font-bold">{message}</p>;

  if (accepted || invitation.status === "accepted") {
    return (
      <section className="mx-auto max-w-lg rounded-3xl border border-[var(--mikke-line)] bg-white p-7 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-emerald-600" size={42} />
        <h1 className="mt-4 text-xl font-bold">Communityにつながりました</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">Academyから指定されたRoomを利用できます。</p>
        <Link href={`/community/c/${invitation.community.slug}`} className="mt-6 inline-flex rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white">Communityを開く</Link>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {preview ? <p className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-bold">ローカル確認用のサンプルです。参加処理やDB変更は行いません。</p> : null}
      <section className="rounded-3xl border border-[var(--mikke-line)] bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-[var(--mikke-accent-soft)] p-3"><GraduationCap size={24} /></span>
          <div><p className="text-xs font-bold text-[var(--mikke-accent)]">{invitation.community.name}からのご案内</p><h1 className="mt-1 text-xl font-bold">Communityへ参加しますか？</h1></div>
        </div>
        <p className="mt-4 text-sm leading-7 text-[var(--mikke-text)]">
          参加すると、この団体から案内されたRoomを追加料金なしで利用できます。
        </p>
        {invitation.hasNormalCommunityAccess ? (
          <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">すでにこのCommunityへ参加しています。現在見られる場所はそのまま利用できます。</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[var(--mikke-line)] bg-white p-6">
        <h2 className="flex items-center gap-2 font-bold"><DoorOpen size={19} /> 参加後に見られるRoom</h2>
        <p className="mt-1 text-sm text-[var(--mikke-muted)]">{invitation.access.name}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">この団体が現在公開しているRoomだけが表示されます。</p>
        <div className="mt-4 space-y-2">
          {invitation.access.rooms.map((room) => <div key={room.id} className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3"><p className="text-sm font-bold">{room.title}</p>{room.description ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">{room.description}</p> : null}</div>)}
          {!invitation.access.rooms.length ? <p className="text-sm text-[var(--mikke-muted)]">対象Roomは準備中です。</p> : null}
        </div>
        {invitation.endsAt ? <p className="mt-4 text-xs font-bold">利用期限: {new Date(invitation.endsAt).toLocaleDateString("ja-JP")}</p> : <p className="mt-4 text-xs font-bold">Academyの利用権が有効な間、利用できます。</p>}
      </section>

      <section className="rounded-3xl border border-[var(--mikke-line)] bg-white p-6">
        <h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={19} /> 参加情報と同意</h2>
        <div className="mt-4 grid gap-3">
          <label className="text-xs font-bold">Communityで表示する名前<input className={inputClass} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
          {invitation.consent.requireLegalName ? <label className="text-xs font-bold">氏名<input className={inputClass} value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} /></label> : null}
          {invitation.consent.requirePhone ? <label className="text-xs font-bold">電話番号<input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label> : null}
          {invitation.consent.requireJoinReason ? <label className="text-xs font-bold">参加理由<textarea className={inputClass} rows={3} value={form.joinReason} onChange={(event) => setForm({ ...form, joinReason: event.target.value })} /></label> : null}
        </div>
        <div className="mt-5 space-y-3">
          {([
            ["terms", `利用規約（第${invitation.consent.termsVersion}版）`, invitation.consent.termsText],
            ["rules", `Communityルール（第${invitation.consent.rulesVersion}版）`, invitation.consent.rulesText],
            ["privacy", `プライバシー（第${invitation.consent.privacyVersion}版）`, invitation.consent.privacyText]
          ] as const).map(([key, label, body]) => (
            <div key={key} className="rounded-xl border border-[var(--mikke-line)] p-3">
              <details><summary className="cursor-pointer text-sm font-bold">{label}を読む</summary><p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-[var(--mikke-muted)]">{body}</p></details>
              <label className="mt-3 flex items-start gap-2 text-sm font-bold"><input type="checkbox" className="mt-1" checked={consent[key]} onChange={(event) => setConsent({ ...consent, [key]: event.target.checked })} />内容を確認し、同意します</label>
            </div>
          ))}
        </div>
        {message ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{message}</p> : null}
        <button type="button" disabled={!canAccept || busy || preview} onClick={() => void accept()} className="mt-5 w-full rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">同意してCommunityへ参加する</button>
      </section>
    </div>
  );
}

export default function CommunityAcademyInvitationPage({ params, searchParams }: { params: Promise<{ invitationId: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { invitationId } = use(params);
  const query = use(searchParams);
  const preview = query.preview === "walkthrough";
  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)] px-5 py-10">
      <AuthGate allowGuest={preview}><InvitationContent invitationId={invitationId} preview={preview} /></AuthGate>
    </main>
  );
}
