"use client";

import { useEffect, useState } from "react";

type InAppBrowser = "LINE" | "Instagram" | "Facebook";

const installGuideUrl = "https://mikke-os.com/install.html";
const storageKey = "mikke_inapp_closed";

function detectInAppBrowser(): InAppBrowser | null {
  const ua = navigator.userAgent || "";
  if (/Line\//i.test(ua)) return "LINE";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook";
  return null;
}

function withExternalBrowserHint(value: string) {
  const url = new URL(value);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}

export function InAppBrowserNotice() {
  const [appName, setAppName] = useState<InAppBrowser | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const detected = detectInAppBrowser();
    if (!detected) return;
    if (window.sessionStorage.getItem(storageKey) === "1") return;
    setAppName(detected);
  }, []);

  if (!appName) return null;

  const externalUrl = withExternalBrowserHint(window.location.href);

  const close = () => {
    window.sessionStorage.setItem(storageKey, "1");
    setAppName(null);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(externalUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-xl rounded-2xl border border-[var(--mikke-line)] bg-white p-4 text-[var(--mikke-text)] shadow-[0_18px_50px_rgba(27,27,31,0.18)]">
      <button
        type="button"
        onClick={close}
        aria-label="閉じる"
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-lg font-bold text-[var(--mikke-muted)]"
      >
        ×
      </button>
      <p className="pr-8 text-sm font-extrabold">{appName}の中で開いています</p>
      <p className="mt-2 pr-6 text-xs leading-6 text-[var(--mikke-muted)]">
        {appName === "LINE"
          ? "下のボタンから、いつも使うブラウザで開けます。記録やコレクションを残すためにおすすめです。"
          : "記録やコレクションを残すには、右上の「…」から「外部ブラウザで開く」を選んでください。"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {appName === "LINE" ? (
          <a href={externalUrl} className="rounded-xl bg-[var(--mikke-orange)] px-4 py-2.5 text-xs font-bold text-white">
            いつものブラウザで開く
          </a>
        ) : (
          <a href={withExternalBrowserHint(installGuideUrl)} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-xs font-bold text-white">
            画像で開き方を見る
          </a>
        )}
        <button type="button" onClick={copyUrl} className="rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5 text-xs font-bold text-[var(--mikke-primary)]">
          {copied ? "コピーしました" : "うまく開かないときはURLコピー"}
        </button>
      </div>
    </div>
  );
}
