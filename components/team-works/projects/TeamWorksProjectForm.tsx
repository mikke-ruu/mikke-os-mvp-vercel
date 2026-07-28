"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";
import { createDeliveryProject } from "@/lib/team-works-delivery";
import { supabase } from "@/lib/supabase/client";

// 2026-07-29: 従来はteamWorksInitialStateのデモデータ(クライアント・ワーカー一覧)と
// テンプレート生成をlocalStorageへ書き込む作りだったため、本部・ワーカー・クライアントの
// 各ポータル間でデータが一切共有されなかった。実際に案件を回すにはSupabase接続が
// 前提のため、まずは最小構成(プロジェクト名のみ)でSupabaseへ作成する形に置き換えた。
// テンプレートからの一括生成・担当メンバー選択は、工程/タスクのSupabase化と合わせて
// 別途対応する。
export function TeamWorksProjectForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const projectId = await createDeliveryProject(supabase, { organizationName, title: name });
      router.push(`/apps/team-works/projects/${projectId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "プロジェクトを作成できませんでした。");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl">
      <MikkeSection title="プロジェクトの基本情報">
        <div className="grid gap-4">
          <TeamWorksProjectField label="プロジェクト名" required>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例：認定講座 教材制作"
              className={teamWorksProjectInputClass}
              required
            />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="組織名" helper="すでに所属組織がある場合は既存組織を使い、この入力は初回セットアップ時だけ使用します。">
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="例：株式会社◯◯、◯◯事務所"
              className={teamWorksProjectInputClass}
            />
          </TeamWorksProjectField>
        </div>
      </MikkeSection>

      {message ? <p role="alert" className="mb-3 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{message}</p> : null}
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-lg bg-[var(--tw-action)] px-4 py-3 text-sm font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]"
      >
        {saving ? "作成しています…" : "プロジェクトを作成"}
      </button>
    </form>
  );
}
