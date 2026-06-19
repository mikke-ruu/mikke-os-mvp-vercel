"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { createMarketEvent } from "@/lib/marketnote";

function NewMarketEventContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [area, setArea] = useState("");
  const [genre, setGenre] = useState("");
  const [publicNote, setPublicNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createMarketEvent(profile, {
        title,
        eventDate,
        venueName,
        area,
        genre,
        publicNote
      });
      router.replace(`/marketnote/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  }

  return (
    <AppShell title="出店予定登録" subtitle="登録するとStory用のActivity Logも作られます">
      <form onSubmit={submit} className="space-y-4">
        <Field label="イベント名" value={title} setValue={setTitle} required />
        <Field label="開催日" value={eventDate} setValue={setEventDate} required type="date" />
        <Field label="会場名" value={venueName} setValue={setVenueName} />
        <Field label="エリア" value={area} setValue={setArea} />
        <Field label="ジャンル" value={genre} setValue={setGenre} placeholder="ハンドメイド / 講座 / 相談 など" />
        <label className="block rounded-2xl border border-[#e8e1da] bg-white p-4">
          <span className="text-sm font-bold">Storyに出せるメモ</span>
          <textarea
            value={publicNote}
            onChange={(event) => setPublicNote(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3"
          />
        </label>
        {error ? <p className="rounded-2xl bg-[#fff0e9] px-4 py-3 text-sm text-[#8f3d22]">{error}</p> : null}
        <button disabled={saving} className="w-full rounded-2xl bg-[#d9643a] px-4 py-3 font-bold text-white disabled:opacity-60">
          {saving ? "保存中..." : "登録する"}
        </button>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  value,
  setValue,
  type = "text",
  required = false,
  placeholder
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block rounded-2xl border border-[#e8e1da] bg-white p-4">
      <span className="text-sm font-bold">{label}</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3"
      />
    </label>
  );
}

export default function NewMarketEventPage() {
  return (
    <AuthGate>
      <NewMarketEventContent />
    </AuthGate>
  );
}
