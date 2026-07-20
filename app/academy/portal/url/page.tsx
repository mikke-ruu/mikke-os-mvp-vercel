"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { QrCode } from "@/components/academy/QrCode";
import { getCoursesByIds, getMyInstructorRecords, updateMyInstructorProfile, type InstructorProfileEdit } from "@/lib/academy/instructor-portal";
import {
  MAX_INSTRUCTOR_ADDRESSES,
  createInstructorAddress,
  deleteInstructorAddress,
  listInstructorAddresses
} from "@/lib/academy/instructor-addresses";
import type { AcademyCourse, AcademyInstructor, AcademyInstructorAddress } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function ProfileEditor({ instructor }: { instructor: AcademyInstructor }) {
  const [form, setForm] = useState<InstructorProfileEdit>({
    business_name: instructor.business_name,
    area: instructor.area,
    online_available: instructor.online_available,
    instagram_url: instructor.instagram_url,
    self_intro: instructor.self_intro,
    message: instructor.message,
    available_note: instructor.available_note,
    accepts_applications: instructor.accepts_applications,
    is_listed: instructor.is_listed,
    display_on_story: instructor.display_on_story,
    payment_method_note: instructor.payment_method_note,
    payment_url: instructor.payment_url
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof InstructorProfileEdit>(key: K, value: InstructorProfileEdit[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await updateMyInstructorProfile(instructor, form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>屋号</label>
          <input className={inputClass} value={form.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>活動地域</label>
          <input className={inputClass} value={form.area ?? ""} onChange={(e) => set("area", e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Instagram URL</label>
        <input className={inputClass} value={form.instagram_url ?? ""} onChange={(e) => set("instagram_url", e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>自己紹介</label>
        <textarea className={`${inputClass} min-h-16`} value={form.self_intro ?? ""} onChange={(e) => set("self_intro", e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>講師からのメッセージ</label>
        <textarea className={`${inputClass} min-h-16`} value={form.message ?? ""} onChange={(e) => set("message", e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>開催可能日・エリアメモ</label>
        <textarea className={`${inputClass} min-h-14`} value={form.available_note ?? ""} onChange={(e) => set("available_note", e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>決済方法メモ</label>
        <textarea
          className={`${inputClass} min-h-14`}
          value={form.payment_method_note ?? ""}
          onChange={(e) => set("payment_method_note", e.target.value)}
          placeholder="例: 銀行振込のみ対応。振込先は別途ご案内します。"
        />
      </div>
      <div>
        <label className={labelClass}>決済URL</label>
        <input
          className={inputClass}
          value={form.payment_url ?? ""}
          onChange={(e) => set("payment_url", e.target.value)}
          placeholder="https://…（受講者への決済案内に使われます）"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
        <input type="checkbox" checked={form.online_available} onChange={(e) => set("online_available", e.target.checked)} />
        オンライン対応
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
        <input type="checkbox" checked={form.accepts_applications} onChange={(e) => set("accepts_applications", e.target.checked)} />
        申込受付を有効にする
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
        <input type="checkbox" checked={form.display_on_story} onChange={(e) => set("display_on_story", e.target.checked)} />
        STORYに表示する
      </label>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "保存中…" : "プロフィールを保存"}
        </button>
        {saved ? <span className="text-xs font-bold text-[var(--mikke-success)]">保存しました</span> : null}
      </div>
    </div>
  );
}

// Wave E (AC-E1): 講師の配送先住所帳。対面キットの送り先を事前に複数登録しておける
// （自宅に限定せず、職場・レンタルサロン等も想定。上限は緩く5件程度でよい）。
function AddressBook({ instructor }: { instructor: AcademyInstructor }) {
  const [addresses, setAddresses] = useState<AcademyInstructorAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [addressText, setAddressText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setAddresses(await listInstructorAddresses(instructor.id));
    setLoading(false);
  }, [instructor.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim() || !addressText.trim()) return setError("ラベルと住所を入力してください。");
    if (addresses.length >= MAX_INSTRUCTOR_ADDRESSES) return setError(`配送先は最大${MAX_INSTRUCTOR_ADDRESSES}件まで登録できます。`);
    setSaving(true);
    try {
      await createInstructorAddress(instructor.id, label, addressText);
      setLabel("");
      setAddressText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteInstructorAddress(instructor.id, id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--mikke-muted)]">
        対面講座のキット送り先として選べる住所です（自宅に限らず、職場・レンタルサロン等でも構いません）。
      </p>
      {loading ? (
        <p className="text-xs text-[var(--mikke-muted)]">読み込み中…</p>
      ) : addresses.length === 0 ? (
        <p className="text-xs text-[var(--mikke-muted)]">まだ登録された配送先がありません。</p>
      ) : (
        <ul className="space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--mikke-text)]">{a.label}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-[var(--mikke-muted)]">{a.address_text}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={busyId === a.id}
                className="shrink-0 rounded-full p-1.5 text-[var(--mikke-muted)] hover:bg-white hover:text-[var(--mikke-danger)]"
                aria-label="削除"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {addresses.length < MAX_INSTRUCTOR_ADDRESSES ? (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input
            className={inputClass}
            placeholder="ラベル（例: 自宅／レンタルサロンA）"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="住所"
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
          />
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-1 rounded-xl bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            <Plus size={13} /> 追加
          </button>
        </form>
      ) : null}
      {error ? <p className="text-xs font-bold text-[var(--mikke-danger)]">{error}</p> : null}
    </div>
  );
}

function UrlContent() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [origin, setOrigin] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOrigin(window.location.origin);
    async function load() {
      const myRecords = await getMyInstructorRecords(profile.user_id);
      setRecords(myRecords);
      setCourseMap(
        Object.fromEntries((await getCoursesByIds(myRecords.map((r) => r.course_id))).map((c) => [c.id, c]))
      );
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  async function copy(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (records.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">まだ講師登録されていません。</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {records.map((rec) => {
        const course = courseMap[rec.course_id];
        const salesUrl = `${origin}/academy/i/${rec.id}`;
        return (
          <section key={rec.id} className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course?.code}</span>
              <h2 className="text-sm font-bold text-[var(--mikke-text)]">{course?.name}</h2>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex-1">
                <p className="text-xs font-bold text-[var(--mikke-accent)]">あなたの営業用URL</p>
                <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">
                  プロフィール付きの講師紹介ページです。SNSやブログでご活用ください。このURLからの申込はあなたに紐づきます。
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input readOnly className={`${inputClass} bg-[var(--mikke-surface-soft)]`} value={salesUrl} />
                  <button
                    type="button"
                    onClick={() => copy(rec.id, salesUrl)}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white"
                  >
                    {copiedId === rec.id ? <Check size={14} /> : <Copy size={14} />}
                    {copiedId === rec.id ? "コピー済" : "コピー"}
                  </button>
                </div>
                <Link
                  href={`/academy/i/${rec.id}`}
                  target="_blank"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]"
                >
                  <ExternalLink size={13} /> プレビューを見る
                </Link>
                {!rec.is_listed || !rec.accepts_applications ? (
                  <p className="mt-2 rounded-xl bg-[var(--mikke-accent-soft)] px-3 py-2 text-[11px] text-[var(--mikke-accent-strong)]">
                    {!rec.is_listed ? "現在「講師一覧掲載」がOFFのため、ページは公開されていません。" : "現在「申込受付」がOFFです。"}
                    下のプロフィール設定や本部の設定をご確認ください。
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
                <p className="mb-2 text-center text-[10px] font-bold tracking-widest text-[var(--mikke-accent-strong)]">QRコード</p>
                <QrCode url={salesUrl} filename={`${course?.code ?? "academy"}-${rec.id.slice(0, 8)}`} />
                <p className="mt-2 max-w-[9rem] text-center text-[10px] leading-4 text-[var(--mikke-muted)]">
                  名刺・チラシに印刷してご活用ください
                </p>
              </div>
            </div>

            <details open>
              <summary className="cursor-pointer text-xs font-bold text-[var(--mikke-accent-strong)]">プロフィールを編集（ページに掲載されます）</summary>
              <div className="mt-3">
                <ProfileEditor instructor={rec} />
              </div>
            </details>

            <details>
              <summary className="cursor-pointer text-xs font-bold text-[var(--mikke-accent-strong)]">配送先住所帳（対面キットの送り先）</summary>
              <div className="mt-3">
                <AddressBook instructor={rec} />
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}

export default function UrlPage() {
  return (
    <KoushiShell title="営業用URL">
      <UrlContent />
    </KoushiShell>
  );
}
