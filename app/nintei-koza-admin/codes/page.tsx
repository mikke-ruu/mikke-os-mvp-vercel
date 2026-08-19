"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { NinteiKozaShell } from "@/components/nintei-koza/NinteiKozaShell";
import {
  formatCode,
  issuePurchaseCode,
  listChapters,
  listPurchases,
  PURCHASE_ROLE_LABELS,
  setPurchaseActive,
  upsertChapters
} from "@/lib/nintei-koza/purchases";
import type { NinteiKozaChapter, NinteiKozaPurchase, NinteiKozaPurchaseRole } from "@/types/database";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]";
const labelClass = "text-xs font-bold text-[var(--mikke-muted)]";

function CopyButton({ text, label = "コードをコピー" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-text-soft)]"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "コピーしました" : label}
    </button>
  );
}

function ChapterUploader() {
  const [chapters, setChapters] = useState<Pick<NinteiKozaChapter, "chapter_id" | "title" | "updated_at">[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listChapters()
      .then(setChapters)
      .catch(() => setChapters([]));
  }, []);

  async function handleFile(file: File) {
    setMessage("");
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.some((c) => typeof c?.chapter_id !== "string" || typeof c?.body !== "string")) {
        throw new Error("chapters.json の形が違います。strip_paid.py が出したファイルを選んでください。");
      }
      const count = await upsertChapters(parsed);
      setChapters(await listChapters());
      setMessage(`${count}章を反映しました。`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "投入に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-4 md:p-5">
      <summary className="cursor-pointer text-sm font-bold text-[var(--mikke-text)]">
        教科書の本文を更新する（普段は使いません）
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-6 text-[var(--mikke-muted)]">
          教科書の本文を書き換えたときだけ使います。<code>05_サイト</code> で <code>python strip_paid.py</code> を実行すると
          <code>_build/chapters.json</code> ができるので、それをここで選びます。
          あわせて <code>_build/data.public.js</code> を公開リポジトリの <code>data.js</code> にコピーしてください。
        </p>
        <input
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
          className="block w-full text-xs text-[var(--mikke-text-soft)]"
        />
        {message ? <p className="text-xs font-bold text-[var(--mikke-accent-strong)]">{message}</p> : null}
        {chapters.length > 0 ? (
          <div className="rounded-xl border border-[var(--mikke-line)] p-3">
            <p className="mb-1 text-xs font-bold text-[var(--mikke-muted)]">投入済み {chapters.length}章</p>
            <ul className="space-y-0.5">
              {chapters.map((c) => (
                <li key={c.chapter_id} className="text-[11px] text-[var(--mikke-muted)]">
                  {c.chapter_id}
                  {c.title ? `　${c.title}` : ""}
                  <span className="text-[var(--mikke-text-soft)]">
                    {new Date(c.updated_at).toLocaleDateString("ja-JP")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-[var(--mikke-muted)]">まだ本文が投入されていません。</p>
        )}
      </div>
    </details>
  );
}

function CodesContent() {
  const [purchases, setPurchases] = useState<NinteiKozaPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<NinteiKozaPurchase | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<NinteiKozaPurchaseRole>("textbook");
  const [issuedFor, setIssuedFor] = useState("site");
  const [note, setNote] = useState("");

  useEffect(() => {
    listPurchases()
      .then(setPurchases)
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const created = await issuePurchaseCode({ email, role, issuedFor, note });
      setPurchases((prev) => [created, ...prev]);
      setIssued(created);
      setEmail("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "発行に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: NinteiKozaPurchase) {
    const updated = await setPurchaseActive(p.code, !p.active);
    setPurchases((prev) => prev.map((x) => (x.code === p.code ? updated : x)));
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleIssue} className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <h2 className="text-sm font-bold text-[var(--mikke-text)]">購入コードを発行する</h2>
        <p className="text-xs leading-6 text-[var(--mikke-muted)]">
          1コード＝1人です。発行したら、購入者にメールでお渡しください。教科書サイトでこのコードを入力すると全11章が開きます。
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>
            購入者のメールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="taro@example.com"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            種別
            <select value={role} onChange={(e) => setRole(e.target.value as NinteiKozaPurchaseRole)} className={inputClass}>
              <option value="textbook">完全版</option>
              <option value="mentoring">個別構築</option>
            </select>
          </label>
          <label className={labelClass}>
            発行の経路
            <select value={issuedFor} onChange={(e) => setIssuedFor(e.target.value)} className={inputClass}>
              <option value="site">サイト直販</option>
              <option value="supporter">サポーター経由</option>
              <option value="manual">その他・手動</option>
            </select>
          </label>
          <label className={labelClass}>
            メモ
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="サポーター〇〇さん経由 / 2026-08-19入金確認"
              className={inputClass}
            />
          </label>
        </div>
        {error ? <p className="text-xs font-bold text-[var(--mikke-danger)]">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "発行中…" : "コードを発行する"}
        </button>
      </form>

      {issued ? (
        <div className="rounded-2xl border border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] p-4 md:p-5">
          <p className="text-xs font-bold text-[var(--mikke-accent-strong)]">発行しました。このコードをお渡しください。</p>
          <p className="my-2 font-mono text-2xl font-bold tracking-[0.2em] text-[var(--mikke-text)]">
            {formatCode(issued.code)}
          </p>
          <CopyButton text={formatCode(issued.code)} />
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-bold text-[var(--mikke-text)]">発行済みのコード</h2>
        {purchases.length === 0 ? (
          <p className="text-xs text-[var(--mikke-muted)]">まだ発行がありません。</p>
        ) : (
          <ul className="space-y-2">
            {purchases.map((p) => (
              <li key={p.code} className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold tracking-[0.15em] text-[var(--mikke-text)]">
                      {formatCode(p.code)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                      {PURCHASE_ROLE_LABELS[p.role]}
                      {p.email ? `　${p.email}` : "　（メール未設定）"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--mikke-muted)]">
                      発行 {new Date(p.created_at).toLocaleDateString("ja-JP")}
                      {p.last_used_at
                        ? `　最終利用 ${new Date(p.last_used_at).toLocaleDateString("ja-JP")}`
                        : "　未使用"}
                      {p.issued_for ? `　経路 ${p.issued_for}` : ""}
                    </p>
                    {p.note ? <p className="mt-0.5 text-[11px] text-[var(--mikke-text-soft)]">{p.note}</p> : null}
                    <div className="mt-2">
                      <CopyButton text={formatCode(p.code)} />
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(p)}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.active
                        ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                        : "bg-[var(--mikke-line)] text-[var(--mikke-muted)]"
                    }`}
                  >
                    {p.active ? "有効" : "停止中"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ChapterUploader />
    </div>
  );
}

export default function NinteiKozaCodesPage() {
  return (
    <NinteiKozaShell title="購入コード">
      <CodesContent />
    </NinteiKozaShell>
  );
}
