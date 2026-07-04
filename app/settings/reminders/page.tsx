"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BellRing, Check, Clock3, Home, ListChecks, RotateCcw, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import {
  defaultReminderSettings,
  loadReminderSettings,
  reminderTargets,
  reminderTimes,
  reminderTimings,
  saveReminderSettings
} from "@/lib/reminders";
import type { ReminderSettings, ReminderTargetKey, ReminderTime, ReminderTimingKey } from "@/lib/reminders";

function RemindersContent() {
  const [settings, setSettings] = useState<ReminderSettings>(defaultReminderSettings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSettings(loadReminderSettings());
  }, []);

  const enabledTargetCount = useMemo(() => {
    return reminderTargets.filter((target) => settings.targets[target.key]).length;
  }, [settings.targets]);

  const enabledTimingCount = useMemo(() => {
    return reminderTimings.filter((timing) => settings.timings[timing.key]).length;
  }, [settings.timings]);

  function updateSettings(patch: Partial<ReminderSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
    setMessage("");
  }

  function toggleTarget(key: ReminderTargetKey) {
    setSettings((current) => ({
      ...current,
      targets: {
        ...current.targets,
        [key]: !current.targets[key]
      }
    }));
    setMessage("");
  }

  function toggleTiming(key: ReminderTimingKey) {
    setSettings((current) => ({
      ...current,
      timings: {
        ...current.timings,
        [key]: !current.timings[key]
      }
    }));
    setMessage("");
  }

  function save() {
    saveReminderSettings(settings);
    setSettings(loadReminderSettings());
    setMessage("通知 / リマインダー設定を保存しました。ホームのやること表示・期限管理に反映する土台として使われます。");
  }

  function resetSettings() {
    setSettings(defaultReminderSettings);
    setMessage("初期設定に戻しました。保存すると反映されます。");
  }

  return (
    <AppShell title="通知 / リマインダー" hideHeader hideBottomNav>
      <div className="pb-5">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center pt-1">
          <Link href="/settings" className="grid h-9 w-9 place-items-center rounded-full text-[#1f1b18]" aria-label="戻る">
            <ArrowLeft size={22} strokeWidth={1.7} />
          </Link>
          <h1 className="text-center text-xl font-semibold tracking-normal text-[#1f1b18]">通知 / リマインダー</h1>
          <span />
        </header>

        <p className="mb-3 rounded-2xl border border-[#eee9e4] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#6f6862] shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
          現在はホームのやること表示・期限管理に反映する設定です。スマホ通知・メール通知・LINE通知は今後対応予定です。
        </p>

        <section className="rounded-[18px] border border-[#e7e1dc] bg-white p-4 shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-[#fff6f1] px-2 py-0.5 text-[10px] font-extrabold text-[#f46a14]">設定</span>
              <h2 className="mt-2 text-lg font-extrabold tracking-normal text-[#1f1b18]">通知 / リマインダーを使う</h2>
              <p className="mt-1 text-xs font-bold leading-5 text-[#8a817a]">OFFにしてもチェック項目や予定は消えません。</p>
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ enabled: !settings.enabled })}
              className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition ${settings.enabled ? "bg-[#ff5a1f]" : "bg-[#d8d2cc]"}`}
              aria-pressed={settings.enabled}
              aria-label="通知 / リマインダーを使う"
            >
              <span className={`block h-6 w-6 rounded-full bg-white shadow-[0_2px_8px_rgba(45,33,22,0.18)] transition ${settings.enabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        </section>

        <SettingsCard
          title="通知対象"
          caption={`${enabledTargetCount}件を対象にしています`}
          icon={<BellRing size={20} strokeWidth={1.8} />}
        >
          <div className="space-y-2">
            {reminderTargets.map((target) => (
              <OptionRow
                key={target.key}
                title={target.label}
                description={target.description}
                active={settings.targets[target.key]}
                onClick={() => toggleTarget(target.key)}
              />
            ))}
          </div>
        </SettingsCard>

        <SettingsCard
          title="通知タイミング"
          caption={`${enabledTimingCount}件のタイミングを使います`}
          icon={<Clock3 size={20} strokeWidth={1.8} />}
        >
          <div className="grid grid-cols-2 gap-2">
            {reminderTimings.map((timing) => {
              const active = settings.timings[timing.key];
              return (
                <button
                  key={timing.key}
                  type="button"
                  onClick={() => toggleTiming(timing.key)}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-extrabold transition ${
                    active
                      ? "border-[#ffb996] bg-[#fff6f1] text-[#ff5a1f]"
                      : "border-[#e7e1dc] bg-white text-[#6f6862]"
                  }`}
                >
                  {active ? <Check size={15} strokeWidth={2} /> : null}
                  {timing.label}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        <SettingsCard
          title="通知時間"
          caption={`${settings.time} に揃える設定です`}
          icon={<Clock3 size={20} strokeWidth={1.8} />}
        >
          <div className="grid grid-cols-4 gap-2">
            {reminderTimes.map((time) => {
              const active = settings.time === time;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => updateSettings({ time })}
                  className={`h-10 rounded-xl border text-sm font-extrabold transition ${
                    active
                      ? "border-[#ff5a1f] bg-[#ff5a1f] text-white shadow-[0_6px_14px_rgba(255,90,31,0.14)]"
                      : "border-[#e7e1dc] bg-white text-[#5f5a55]"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        <section className="mt-3 rounded-2xl border border-[#eee9e4] bg-white p-3.5 shadow-[0_3px_12px_rgba(45,33,22,0.035)]">
          <h2 className="text-sm font-extrabold text-[#1f1b18]">接続メモ</h2>
          <div className="mt-2 space-y-2">
            <ConnectionItem icon={<Home size={15} />} title="ホームのやること" text="保存した対象とタイミングを、期限順表示の強調や対象選びへつなげます。" />
            <ConnectionItem icon={<ListChecks size={15} />} title="チェックテンプレート" text="開催日当日、前日、3日前、7日前の期限ルールと矛盾しない形で使います。" />
            <ConnectionItem icon={<BellRing size={15} />} title="出店詳細" text="チェック項目と支払い情報を、後で支払い期限・準備確認へ接続しやすくします。" />
          </div>
        </section>

        {message ? <p className="mt-3 rounded-xl bg-[#fff0e9] px-4 py-3 text-sm font-bold text-[#8f3d22]">{message}</p> : null}

        <div className="mt-4 space-y-2.5">
          <button type="button" onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] px-4 py-3 text-base font-extrabold text-white shadow-[0_8px_18px_rgba(255,90,31,0.16)]">
            <Save size={17} strokeWidth={1.8} />
            保存
          </button>
          <button type="button" onClick={resetSettings} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#ff8a5c] bg-white px-4 py-3 text-sm font-extrabold text-[#ff5a1f]">
            <RotateCcw size={16} strokeWidth={1.8} />
            初期設定に戻す
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function SettingsCard({
  title,
  caption,
  icon,
  children
}: {
  title: string;
  caption: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 rounded-[18px] border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
      <div className="border-b border-[#f1ece7] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-normal text-[#1f1b18]">{title}</h2>
            <p className="mt-1 text-xs font-bold text-[#8a817a]">{caption}</p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff6f1] text-[#ff5a1f]">
            {icon}
          </span>
        </div>
      </div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function OptionRow({
  title,
  description,
  active,
  onClick
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid w-full grid-cols-[24px_1fr] items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
        active ? "border-[#ffb996] bg-[#fff6f1]" : "border-[#e7e1dc] bg-white"
      }`}
    >
      <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full border ${active ? "border-[#ff5a1f] bg-[#ff5a1f] text-white" : "border-[#d8d2cc] text-transparent"}`}>
        <Check size={12} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-[#1f1b18]">{title}</span>
        <span className="mt-0.5 block text-xs font-bold leading-5 text-[#8a817a]">{description}</span>
      </span>
    </button>
  );
}

function ConnectionItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="grid grid-cols-[24px_1fr] gap-2 rounded-xl bg-[#fbfaf8] px-3 py-2.5">
      <span className="grid h-6 w-6 place-items-center rounded-full text-[#ff5a1f]">{icon}</span>
      <span>
        <span className="block text-xs font-extrabold text-[#1f1b18]">{title}</span>
        <span className="mt-0.5 block text-xs font-bold leading-5 text-[#6f6862]">{text}</span>
      </span>
    </div>
  );
}

export default function RemindersPage() {
  return (
    <AuthGate>
      <RemindersContent />
    </AuthGate>
  );
}

