"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Database, Plus } from "lucide-react";
import { ActivityLogList } from "./ActivityLogList";
import { MikkeAppShell } from "./MikkeAppShell";
import { appActionPresets, createActivityFromPreset } from "@/lib/mikkeos/app-actions";
import { getAppDefinition } from "@/lib/mikkeos/apps";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";
import { getAppPath } from "@/lib/mikkeos/routes";
import {
  saveItemStudioRegistrationSupabaseTest,
  saveItemStudioSaleSupabaseTest,
  type ItemStudioSupabaseTestResult
} from "@/lib/mikkeos/item-studio-supabase-test";
import type { AppKey } from "@/lib/mikkeos/types";
import { formatYen } from "@/lib/format";

const text = {
  subtitle: "\u3053\u306e\u30a2\u30d7\u30ea\u304b\u3089\u5171\u901a\u53f0\u5e33\u3078\u9001\u308b\u6d3b\u52d5\u3092\u78ba\u8a8d\u3059\u308b\u30df\u30cb\u753b\u9762",
  activeStatus: "\u5b9f\u88c5\u571f\u53f0\u3042\u308a",
  prototypeStatus: "\u63a5\u7d9a\u691c\u8a3c",
  plannedStatus: "\u69cb\u60f3\u4e2d",
  sendToLog: "\u5171\u901a\u53f0\u5e33\u3078\u9001\u308b",
  storyOn: "Story\u306b\u516c\u958b",
  storyOff: "Story\u5bfe\u8c61\u5916",
  deskOn: "DESK\u306b\u96c6\u8a08",
  deskOff: "DESK\u5bfe\u8c61\u5916",
  samples: "\u30b5\u30f3\u30d7\u30eb\u6d3b\u52d5\u4e00\u89a7",
  samplesLead: "\u5b8c\u6210\u6a5f\u80fd\u3067\u306f\u306a\u304f\u3001\u6d3b\u52d5\u304c\u5171\u901a\u53f0\u5e33\u3078\u6d41\u308c\u308b\u78ba\u8a8d\u7528\u3067\u3059\u3002",
  addButton: "\u3053\u306e\u6d3b\u52d5\u3092\u8a18\u9332\u306b\u8ffd\u52a0",
  previewTitle: "\u8ffd\u52a0\u3055\u308c\u308b\u8a18\u9332",
  previewLead: "\u30dc\u30bf\u30f3\u3092\u62bc\u3059\u3068\u3001\u3053\u306e\u5185\u5bb9\u304c\u5171\u901a\u53f0\u5e33\u306b\u8ffd\u52a0\u3055\u308c\u307e\u3059\u3002",
  added: "\u8a18\u9332\u306b\u8ffd\u52a0\u3057\u307e\u3057\u305f",
  logLink: "\u8a18\u9332\u3092\u898b\u308b",
  storyLink: "Story\u3067\u78ba\u8a8d",
  deskLink: "DESK\u3067\u78ba\u8a8d",
  appLogsTitle: "\u3053\u306e\u30a2\u30d7\u30ea\u304b\u3089\u8ffd\u52a0\u3055\u308c\u305f\u8a18\u9332"
};

export function AppMiniPage({ appKey }: { appKey: AppKey }) {
  const app = getAppDefinition(appKey);
  const presets = appActionPresets[appKey];
  const { logs, addLog } = useUnifiedActivityLogs();
  const [selectedId, setSelectedId] = useState(presets[0]?.id ?? "");
  const [addedLogId, setAddedLogId] = useState<string | null>(null);
  const [supabaseTest, setSupabaseTest] = useState<{
    status: "idle" | "saving" | "success" | "error";
    message?: string;
    result?: ItemStudioSupabaseTestResult;
  }>({ status: "idle" });
  const selectedPreset = presets.find((preset) => preset.id === selectedId) ?? presets[0];

  const appLogs = useMemo(() => logs.filter((log) => log.appKey === appKey), [appKey, logs]);
  const previewLog = selectedPreset ? createActivityFromPreset(selectedPreset) : null;
  const canRunItemStudioSupabaseTest =
    appKey === "item_studio" && (selectedPreset?.id === "item-created" || selectedPreset?.id === "item-sold") && previewLog;
  const itemStudioSupabaseTestCopy =
    selectedPreset?.id === "item-sold"
      ? {
          lead: "「販売を記録」だけをDBへ保存します。金額ありログがStoryや活動実績に混ざらず、DESK対象になるか確認します。",
          button: "この販売記録をSupabaseへテスト保存"
        }
      : {
          lead: "「作品を登録」だけをDBへ保存します。通常の記録画面はまだlocalStorageのままです。",
          button: "この作品登録をSupabaseへテスト保存"
        };

  function addActivity() {
    if (!selectedPreset) return;
    const nextLog = createActivityFromPreset(selectedPreset);
    addLog(nextLog);
    setAddedLogId(nextLog.id);
  }

  async function runItemStudioSupabaseTest() {
    if (!previewLog || appKey !== "item_studio") return;
    setSupabaseTest({ status: "saving", message: "Supabaseへテスト保存しています" });

    try {
      const result =
        selectedPreset?.id === "item-created"
          ? await saveItemStudioRegistrationSupabaseTest(previewLog)
          : selectedPreset?.id === "item-sold"
            ? await saveItemStudioSaleSupabaseTest(previewLog)
            : null;
      if (!result) return;
      setSupabaseTest({ status: "success", message: "Supabaseへテスト保存しました", result });
    } catch (error) {
      setSupabaseTest({
        status: "error",
        message: error instanceof Error ? error.message : "Supabaseテスト保存に失敗しました"
      });
    }
  }

  return (
    <MikkeAppShell appName={app.name} title={app.name} subtitle={text.subtitle} currentApp={{ label: app.shortName, href: getAppPath(app.key) }}>
      <section className="rounded-3xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mikke-accent)]">App Mini</p>
        <h2 className="mt-2 text-3xl font-bold tracking-normal">{app.name}</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">{app.role}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <InfoChip
            active={app.status === "active"}
            label={
              app.status === "active"
                ? text.activeStatus
                : app.status === "prototype"
                  ? text.prototypeStatus
                  : text.plannedStatus
            }
          />
          <InfoChip active label={text.sendToLog} />
          <InfoChip
            active={selectedPreset?.storyEnabled ?? false}
            label={(selectedPreset?.storyEnabled ?? false) ? text.storyOn : text.storyOff}
          />
          <InfoChip
            active={selectedPreset?.deskEnabled ?? false}
            label={(selectedPreset?.deskEnabled ?? false) ? text.deskOn : text.deskOff}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold tracking-normal">{text.samples}</h2>
        <p className="mt-1 text-sm text-[var(--mikke-muted)]">{text.samplesLead}</p>
        <div className="mt-4 grid gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setSelectedId(preset.id);
                setAddedLogId(null);
                setSupabaseTest({ status: "idle" });
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedId === preset.id
                  ? "border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)]"
                  : "border-[var(--mikke-line)] bg-white hover:bg-[var(--mikke-surface-soft)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--mikke-text)]">{preset.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{preset.description}</p>
                </div>
                {typeof preset.amount === "number" ? (
                  <span className="shrink-0 rounded-full bg-[var(--mikke-success-soft)] px-2.5 py-1 text-xs font-bold text-[var(--mikke-success)]">
                    {formatYen(preset.amount)}
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addActivity}
          disabled={!selectedPreset}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} />
          {text.addButton}
        </button>
        {canRunItemStudioSupabaseTest ? (
          <section className="mt-4 rounded-2xl border border-dashed border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-white p-2 text-[var(--mikke-accent)]">
                <Database size={18} />
              </span>
              <div>
                <p className="text-sm font-bold text-[var(--mikke-text)]">Supabase保存テスト</p>
                <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{itemStudioSupabaseTestCopy.lead}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={runItemStudioSupabaseTest}
              disabled={supabaseTest.status === "saving"}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--mikke-accent)] bg-white px-4 py-3 text-sm font-bold text-[var(--mikke-accent)] disabled:cursor-wait disabled:opacity-60"
            >
              <Database size={17} />
              {supabaseTest.status === "saving" ? "保存中" : itemStudioSupabaseTestCopy.button}
            </button>
            {supabaseTest.message ? (
              <p className={`mt-3 text-xs font-bold ${supabaseTest.status === "error" ? "text-[var(--mikke-danger)]" : "text-[var(--mikke-success)]"}`}>
                {supabaseTest.message}
              </p>
            ) : null}
            {supabaseTest.result ? <SupabaseTestResult result={supabaseTest.result} /> : null}
          </section>
        ) : null}
      </section>

      {previewLog ? (
        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-lg font-bold tracking-normal">{text.previewTitle}</h2>
            <p className="mt-1 text-sm text-[var(--mikke-muted)]">{text.previewLead}</p>
          </div>
          <ActivityLogList logs={[previewLog]} />
        </section>
      ) : null}

      {addedLogId ? (
        <section className="mt-6 rounded-2xl border border-[var(--mikke-success)] bg-[var(--mikke-success-soft)] p-4 text-sm font-bold text-[var(--mikke-success)]">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={18} />
            {text.added}
          </span>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/log" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-[var(--mikke-accent)]">
              {text.logLink} <ArrowRight size={14} />
            </Link>
            <Link href="/story" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-[var(--mikke-accent)]">
              {text.storyLink} <ArrowRight size={14} />
            </Link>
            <Link href="/desk" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-[var(--mikke-accent)]">
              {text.deskLink} <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold tracking-normal">{text.appLogsTitle}</h2>
        <ActivityLogList logs={appLogs.slice(0, 5)} />
      </section>
    </MikkeAppShell>
  );
}

function InfoChip({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 ${
        active
          ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"
          : "bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function SupabaseTestResult({ result }: { result: ItemStudioSupabaseTestResult }) {
  return (
    <div className="mt-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-3 text-xs text-[var(--mikke-muted)]">
      <p className="font-bold text-[var(--mikke-text)]">保存確認</p>
      <dl className="mt-2 grid gap-1.5">
        <ResultLine label="insert" value={result.insert.ok ? "ok" : "ng"} />
        <ResultLine label="select" value={result.select.ok ? "ok" : "ng"} />
        <ResultLine label="source_record_id" value={result.sourceRecordId} />
        <ResultLine label="source_service" value={result.select.row.source_service} />
        <ResultLine label="category" value={result.select.row.category} />
        <ResultLine label="visibility" value={result.select.row.visibility} />
        <ResultLine label="display_story" value={String(result.select.row.display_on_story)} />
        <ResultLine label="counts_summary" value={String(result.select.row.counts_toward_summary)} />
        <ResultLine label="financial" value={String(result.select.row.has_financial_value)} />
        <ResultLine label="amount" value={result.select.row.amount === null ? "null" : String(result.select.row.amount)} />
        <ResultLine label="transaction" value={result.select.row.transaction_type} />
        <ResultLine label="payment" value={result.select.row.payment_status} />
        <ResultLine label="Story" value={result.story.visible && result.story.public_policy_readable ? "公開対象" : "対象外"} />
        <ResultLine label="DESK" value={result.desk.counted ? "集計対象" : "対象外"} />
        <ResultLine label="活動実績" value={result.summary.counted ? "含める" : "対象外"} />
      </dl>
    </div>
  );
}

function ResultLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
      <dt className="font-bold text-[var(--mikke-muted-light)]">{label}</dt>
      <dd className="break-words text-[var(--mikke-text)]">{value}</dd>
    </div>
  );
}
