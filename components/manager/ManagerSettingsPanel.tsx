"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { useOwnedMikkeApps } from "@/components/mikkeos/useOwnedMikkeApps";
import { useManagerPersonalEvents, useManagerPreferences } from "@/lib/manager/store";
import {
  replaceMyMikkeMenuPreferences,
  resetMyMikkeMenuPreferences
} from "@/lib/mikkeos/menu-preferences";
import type { MikkeMenuAppKey } from "@/lib/mikkeos/menu-preferences-model";
import { mikkeMenuAppOrder, mikkeMenuAppRegistry } from "@/lib/mikkeos/released-apps";
import { ManagerAppMenuPreferencesPanel, type ManagerMenuAppDraftItem } from "./ManagerAppMenuPreferencesPanel";
import { ManagerShell } from "./ManagerShell";

export function ManagerSettingsPanel() {
  const { profile, isGuest } = useAuth();
  const { preferences, updatePreferences } = useManagerPreferences();
  const { personalEvents } = useManagerPersonalEvents();
  const {
    ownedAppKeys,
    hiddenOwnedAppKeys,
    preferenceLoading,
    preferenceError,
    refreshMenuPreferences
  } = useOwnedMikkeApps({ userId: profile.user_id, isGuest });
  const [menuDraft, setMenuDraft] = useState<ManagerMenuAppDraftItem[]>([]);
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuActionError, setMenuActionError] = useState<string | null>(null);
  const [menuSaved, setMenuSaved] = useState(false);
  const hiddenOwnedKeySet = useMemo(() => new Set(hiddenOwnedAppKeys), [hiddenOwnedAppKeys]);

  useEffect(() => {
    setMenuDraft(ownedAppKeys.map((key) => ({
      key,
      label: mikkeMenuAppRegistry[key].title,
      isHidden: hiddenOwnedKeySet.has(key)
    })));
  }, [hiddenOwnedKeySet, ownedAppKeys]);

  function moveMenuApp(key: MikkeMenuAppKey, direction: -1 | 1) {
    setMenuSaved(false);
    setMenuDraft((current) => {
      const index = current.findIndex((app) => app.key === key);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  function toggleMenuApp(key: MikkeMenuAppKey) {
    setMenuSaved(false);
    setMenuDraft((current) => current.map((app) => (
      app.key === key ? { ...app, isHidden: !app.isHidden } : app
    )));
  }

  async function saveMenuApps() {
    setMenuSaving(true);
    setMenuSaved(false);
    setMenuActionError(null);
    try {
      await replaceMyMikkeMenuPreferences({
        orderedAppKeys: menuDraft.map((app) => app.key),
        hiddenAppKeys: menuDraft.filter((app) => app.isHidden).map((app) => app.key)
      });
      refreshMenuPreferences();
      setMenuSaved(true);
    } catch {
      setMenuActionError("アプリメニューを保存できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setMenuSaving(false);
    }
  }

  async function resetMenuApps() {
    setMenuSaving(true);
    setMenuSaved(false);
    setMenuActionError(null);
    try {
      await resetMyMikkeMenuPreferences();
      const ownedKeySet = new Set(ownedAppKeys);
      setMenuDraft(mikkeMenuAppOrder
        .filter((key) => ownedKeySet.has(key))
        .map((key) => ({ key, label: mikkeMenuAppRegistry[key].title, isHidden: false })));
      refreshMenuPreferences();
      setMenuSaved(true);
    } catch {
      setMenuActionError("アプリメニューを既定に戻せませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setMenuSaving(false);
    }
  }

  return (
    <ManagerShell title="設定" subtitle="Managerとアプリメニューの見え方を調整します。">
      <ManagerAppMenuPreferencesPanel
        apps={menuDraft}
        loading={preferenceLoading}
        saving={menuSaving}
        error={menuActionError ?? preferenceError}
        saved={menuSaved}
        onMove={moveMenuApp}
        onToggle={toggleMenuApp}
        onSave={() => void saveMenuApps()}
        onReset={() => void resetMenuApps()}
      />

      <section className="mt-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold tracking-normal">表示設定</h2>
        <p className="mt-1 text-sm text-[var(--mikke-muted)]">設定はManager専用に保存され、各アプリのデータは変更しません。</p>

        <div className="mt-5 grid gap-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
            <span>
              <span className="block text-sm font-bold text-[var(--mikke-text)]">完了済みも表示する</span>
              <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">完了・キャンセル済みの予定や進行もManager一覧に残します。</span>
            </span>
            <input
              type="checkbox"
              checked={preferences.showCompleted}
              onChange={(event) => updatePreferences({ showCompleted: event.target.checked })}
              className="h-5 w-5 accent-[var(--mikke-accent)]"
            />
          </label>
        </div>
      </section>

      {personalEvents.length > 0 ? (
        <section className="mt-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold tracking-normal">以前の個人予定</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">
            この端末のManagerに保存されている個人予定が{personalEvents.length}件あります。MarketNoteへの移行方法が決まるまで、ここから確認・編集できます。
          </p>
          <Link
            href="/manager/calendar"
            className="mt-4 inline-flex rounded-full border border-[var(--mikke-line)] bg-white px-4 py-2 text-sm font-bold text-[var(--mikke-primary)]"
          >
            個人予定を確認する
          </Link>
        </section>
      ) : null}
    </ManagerShell>
  );
}
