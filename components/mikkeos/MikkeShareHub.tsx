"use client";

import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  QrCode,
  Share2,
  Sparkles
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import {
  getExternalBrowserShareUrl,
  mikkeShareTargets,
  normalizeMikkeShareSource,
  type MikkeShareTarget
} from "@/lib/mikkeos/share-targets";

export function MikkeShareHub() {
  const searchParams = useSearchParams();
  const source = normalizeMikkeShareSource(searchParams.get("from"));
  const [selectedId, setSelectedId] = useState(() => defaultTargetId(source));
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  const selected = mikkeShareTargets.find((target) => target.id === selectedId) ?? mikkeShareTargets[0];
  const shareUrl = selected ? getExternalBrowserShareUrl(selected.url) : "";

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl("");
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl, { errorCorrectionLevel: "M", margin: 1, scale: 7 })
      .then((value) => { if (!cancelled) setQrDataUrl(value); })
      .catch(() => { if (!cancelled) setMessage("QRコードを作れませんでした。URLコピーをご利用ください。"); });
    return () => { cancelled = true; };
  }, [shareUrl]);

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setMessage("URLをコピーしました。");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("URLをコピーできませんでした。URLを長押ししてコピーしてください。");
    }
  }

  async function share() {
    if (!selected || !shareUrl) return;
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: selected.title, text: selected.description, url: shareUrl });
    } catch {
      // 共有シートを閉じただけの場合は案内を出さない。
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--mikke-surface-soft)] px-4 py-5 text-[var(--mikke-text)] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start gap-3">
          <button type="button" onClick={() => history.back()} aria-label="前の画面に戻る" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--mikke-line)] bg-white">
            <ArrowLeft size={19} />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">SHARE・QR</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-[var(--mikke-primary)]">このアプリを共有する</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">見せたいQRを選んで、そのまま相手に読み取ってもらえます。</p>
          </div>
        </header>

        <div className="mx-auto mt-6 max-w-2xl space-y-5">
          {selected ? (
            <section id="share-detail" className="scroll-mt-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold text-[var(--mikke-primary)]">QR</p>
                {selected.source === source ? <span className="rounded-full bg-[var(--mikke-accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--mikke-primary)]">今いるアプリ</span> : null}
              </div>
              <h2 className="mt-2 text-lg font-bold tracking-normal">{selected.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{selected.description}</p>
              <div className="mx-auto mt-5 aspect-square w-full max-w-56 rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
                {qrDataUrl ? <img src={qrDataUrl} alt={`${selected.title}のQRコード`} className="h-full w-full" /> : <div className="grid h-full place-items-center text-xs text-[var(--mikke-muted)]">QRコードを準備しています</div>}
              </div>
              <p className="mt-4 break-all rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5 text-[var(--mikke-muted)]">{selected.url}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void copy()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 text-sm font-bold">
                  {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "コピー済み" : "URLコピー"}
                </button>
                <button type="button" onClick={() => void share()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--mikke-orange)] px-3 text-sm font-bold text-white">
                  <Share2 size={17} /> 共有する
                </button>
              </div>
              <a href={selected.url} target="_blank" rel="noreferrer" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--mikke-accent-soft)] px-4 text-sm font-bold text-[var(--mikke-primary)]">
                {selected.actionLabel} <ExternalLink size={15} />
              </a>
              <p className="mt-4 text-xs leading-5 text-[var(--mikke-muted)]">LINEで受け取った場合も、コピーせず通常のブラウザで開けるURLを共有します。</p>
              {message ? <p aria-live="polite" className="mt-3 rounded-xl bg-[var(--mikke-green)]/25 px-3 py-2 text-xs font-bold">{message}</p> : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 sm:p-5">
            <h2 className="text-base font-bold">他のアプリもおすすめする</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">アイコンを押すと、上のQRが切り替わります。</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {mikkeShareTargets.map((target) => (
                <ShareTargetButton key={target.id} target={target} selected={selected?.id === target.id} onClick={() => selectTarget(target.id, setSelectedId, setMessage)} />
              ))}
            </div>
            {source === "community" ? <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5 text-[var(--mikke-muted)]">Communityは一般公開前のため、団体専用の招待URLをご利用ください。</p> : null}
          </section>
        </div>

        <p className="mt-6 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">share by mikke</p>
      </div>
    </main>
  );
}

function ShareTargetButton({ target, selected, onClick }: { target: MikkeShareTarget; selected: boolean; onClick: () => void }) {
  const Icon = target.id === "mikke-home" ? Globe2 : target.source === "marketnote" ? CalendarDays : target.source === "story" ? BookOpenText : Sparkles;
  const background = target.tone === "orange" ? "var(--mikke-orange)" : target.tone === "pink" ? "var(--mikke-pink)" : "var(--mikke-blue)";
  const foreground = target.tone === "pink" ? "var(--mikke-text)" : "#fff";
  return (
    <button type="button" onClick={onClick} className={`flex min-h-36 w-full flex-col items-start rounded-2xl border p-3 text-left ${selected ? "border-[var(--mikke-primary)] bg-[var(--mikke-accent-soft)] ring-1 ring-[var(--mikke-primary)]" : "border-[var(--mikke-line)] bg-white"}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background, color: foreground }}><Icon size={21} /></span>
      <span className="mt-3 block text-sm font-bold">{target.title}</span>
      <span className="mt-1 block text-[11px] leading-[1.55] text-[var(--mikke-muted)]">{target.description}</span>
    </button>
  );
}

function defaultTargetId(source: ReturnType<typeof normalizeMikkeShareSource>) {
  if (source === "marketnote") return "marketnote";
  if (source === "story") return "story";
  return "mikke-home";
}

function selectTarget(id: string, setSelectedId: (id: string) => void, setMessage: (message: string) => void) {
  setSelectedId(id);
  setMessage("");
  window.setTimeout(() => document.getElementById("share-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}
