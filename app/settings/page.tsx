"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";

function SettingsContent() {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [area, setArea] = useState(profile.area ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        handle,
        area: area || null,
        bio: bio || null
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await refreshProfile();
    setMessage("保存しました。");
  }

  return (
    <AppShell title="設定" subtitle="Mikke IDの基本情報">
      <form onSubmit={save} className="space-y-4">
        <label className="block rounded-2xl border border-[#e8e1da] bg-white p-4">
          <span className="text-sm font-bold">表示名</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3"
          />
        </label>
        <label className="block rounded-2xl border border-[#e8e1da] bg-white p-4">
          <span className="text-sm font-bold">ハンドル</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3"
          />
        </label>
        <label className="block rounded-2xl border border-[#e8e1da] bg-white p-4">
          <span className="text-sm font-bold">活動地域</span>
          <input
            value={area}
            onChange={(event) => setArea(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3"
          />
        </label>
        <label className="block rounded-2xl border border-[#e8e1da] bg-white p-4">
          <span className="text-sm font-bold">活動紹介</span>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-[#e8e1da] bg-[#fbfaf8] px-3 py-3"
          />
        </label>
        {message ? <p className="rounded-2xl bg-[#fff0e9] px-4 py-3 text-sm text-[#8f3d22]">{message}</p> : null}
        <button className="w-full rounded-2xl bg-[#d9643a] px-4 py-3 font-bold text-white">保存</button>
      </form>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <AuthGate>
      <SettingsContent />
    </AuthGate>
  );
}
