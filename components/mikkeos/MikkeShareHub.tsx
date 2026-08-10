"use client";

import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  HousePlus,
  QrCode,
  Share2,
  Sparkles
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { getMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { getStoryPublicUrl } from "@/lib/mikkeos/story-profile-store";
import {
  getExternalBrowserShareUrl,
  mikkeShareTargets,
  normalizeMikkeShareSource,
  type MikkeShareTarget
} from "@/lib/mikkeos/share-targets";
import { supabase } from "@/lib/supabase/client";

const installGuideUrl = "https://mikke-os.com/install.html";

export function MikkeShareHub() {
  const searchParams = useSearchParams();
  const source = normalizeMikkeShareSource(searchParams.get("from"));
  const [myStoryTarget, setMyStoryTarget] = useState<MikkeShareTarget | null>(null);
  const [selectedId, setSelectedId] = useState(() => defaultTargetId(source));
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return null;
      return getMyStoryProfile(supabase);
    }).then((story) => {
      if (cancelled || !story?.isPublished) return;
      setMyStoryTarget({
        id: "my-story",
        source: "story",
        title: "私のSTORYを見てもらう",
        description: "公開中のプロフィールを、名刺のように渡せます。",
        url: getStoryPublicUrl(story.handle),
        actionLabel: "相手に見える画面を確認",
        tone: "blue"
      });
      if (source === "story") setSelectedId("my-story");
    }).catch(() => {
      // STORYが未作成・未公開でも、一般向けの紹介はそのまま利用できる。
    });
    return () => { cancelled = true; };
  }, [source]);

  const targets = useMemo(() => {
    const current = mikkeShareTargets.filter((target) => target.source === source);
    const others = mikkeShareTargets.filter((target) => target.source !== source);
    return [...(myStoryTarget ? [myStoryTarget] : []), ...current, ...others];
  }, [myStoryTarget, source]);
  const selected = targets.find((target) => target.id === selectedId) ?? targets[0];
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
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-[var(--mikke-primary)]">何を教えますか？</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">ボタンを選ぶと、説明・QRコード・URLが一緒に出ます。</p>
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 sm:p-5">
            {myStoryTarget ? (
              <ShareGroup title="自分のページ" helper="あなたが公開した内容だけを渡します。">
                <ShareTargetButton target={myStoryTarget} selected={selected?.id === myStoryTarget.id} onClick={() => selectTarget(myStoryTarget.id, setSelectedId, setMessage)} />
              </ShareGroup>
            ) : null}

            <ShareGroup title={source === "mikke" || source === "community" ? "使えるアプリ" : "今いるアプリ"} helper="すぐ使ってもらうか、説明を見てもらうかを選べます。" separated={Boolean(myStoryTarget)}>
              {targets.filter((target) => target.source === source && target.id !== "my-story").map((target) => (
                <ShareTargetButton key={target.id} target={target} selected={selected?.id === target.id} onClick={() => selectTarget(target.id, setSelectedId, setMessage)} />
              ))}
              {source === "community" ? <p className="rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5 text-[var(--mikke-muted)]">Communityは一般公開前のため、ここからは共有しません。団体専用の招待URLをご利用ください。</p> : null}
            </ShareGroup>

            <ShareGroup title="ほかにも教えられます" helper="公開中のアプリとmikkeのホームページだけを表示しています。" separated>
              {targets.filter((target) => target.source !== source && target.id !== "my-story").map((target) => (
                <ShareTargetButton key={target.id} target={target} selected={selected?.id === target.id} onClick={() => selectTarget(target.id, setSelectedId, setMessage)} />
              ))}
            </ShareGroup>

            <section className="mt-5 border-t border-[var(--mikke-line-soft)] pt-5">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-accent-soft)] text-[var(--mikke-primary)]"><HousePlus size={20} /></span>
                <div>
                  <h2 className="text-sm font-bold">ホーム画面に追加する方法</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">iPhoneはSafariの共有ボタン、AndroidはChromeのメニューから追加できます。</p>
                </div>
              </div>
              <a href={getExternalBrowserShareUrl(installGuideUrl)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-4 text-sm font-bold text-[var(--mikke-primary)]">
                画像つきの追加方法を見る <ExternalLink size={15} />
              </a>
            </section>
          </section>

          {selected ? (
            <aside id="share-detail" className="scroll-mt-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm lg:sticky lg:top-5">
              <p className="text-xs font-bold text-[var(--mikke-primary)]">選んだ共有先</p>
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
            </aside>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">share by mikke</p>
      </div>
    </main>
  );
}

function ShareGroup({ title, helper, separated = false, children }: { title: string; helper: string; separated?: boolean; children: React.ReactNode }) {
  return <section className={separated ? "mt-5 border-t border-[var(--mikke-line-soft)] pt-5" : ""}><h2 className="text-sm font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{helper}</p><div className="mt-3 grid gap-2">{children}</div></section>;
}

function ShareTargetButton({ target, selected, onClick }: { target: MikkeShareTarget; selected: boolean; onClick: () => void }) {
  const Icon = target.id === "mikke-home" ? Globe2 : target.source === "marketnote" ? CalendarDays : target.id === "my-story" ? QrCode : target.source === "story" ? BookOpenText : Sparkles;
  const background = target.tone === "orange" ? "var(--mikke-orange)" : target.tone === "pink" ? "var(--mikke-pink)" : "var(--mikke-blue)";
  const foreground = target.tone === "pink" ? "var(--mikke-text)" : "#fff";
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected ? "border-[var(--mikke-primary)] bg-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] bg-white"}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background, color: foreground }}><Icon size={19} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{target.title}</span><span className="mt-0.5 block text-xs leading-5 text-[var(--mikke-muted)]">{target.description}</span></span>
      <span className="text-lg text-[var(--mikke-muted-light)]">›</span>
    </button>
  );
}

function defaultTargetId(source: ReturnType<typeof normalizeMikkeShareSource>) {
  if (source === "marketnote") return "marketnote-use";
  if (source === "story") return "story-about";
  return "mikke-home";
}

function selectTarget(id: string, setSelectedId: (id: string) => void, setMessage: (message: string) => void) {
  setSelectedId(id);
  setMessage("");
  window.setTimeout(() => document.getElementById("share-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
}
