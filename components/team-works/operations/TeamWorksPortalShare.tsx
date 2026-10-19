"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export const TEAM_WORKS_PORTALS = [
  { role: "client", label: "クライアント", url: "https://app.mikke-os.com/apps/team-works/portal/client" },
  { role: "worker", label: "パートナー", url: "https://app.mikke-os.com/apps/team-works/portal/worker" }
] as const;

const buttonClass = "rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-bold disabled:opacity-50";

function PortalCard({ portal }: { portal: (typeof TEAM_WORKS_PORTALS)[number] }) {
  const [qr, setQr] = useState("");
  const [notice, setNotice] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const guidance = `Team Worksの${portal.label}ポータルはこちらです。\n${portal.url}\n\n招待を受けたメールアドレスでログインしてください。初めての方は、そのメールアドレスで新規登録してください。ログイン後に承認のお知らせがあれば、対象のプロジェクトを確認して承認してください。`;

  useEffect(() => {
    let active = true;
    setCanShare(typeof navigator.share === "function");
    QRCode.toDataURL(portal.url, { width: 640, margin: 4, errorCorrectionLevel: "M" })
      .then((data) => { if (active) setQr(data); })
      .catch(() => { if (active) setNotice("QRコードを作成できませんでした。URLをコピーしてご案内ください。"); });
    return () => { active = false; };
  }, [portal.url]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("コピーしました。LINEなどに貼り付けて送れます。");
    } catch {
      setNotice("コピーできませんでした。下の案内文を選択してコピーしてください。");
    }
  }

  async function share() {
    setSharing(true);
    try {
      await navigator.share({ title: `Team Works ${portal.label}ポータル`, text: guidance });
      setNotice("共有操作が完了しました。");
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setNotice("共有できませんでした。「案内文とURLをコピー」をお使いください。");
      }
    } finally { setSharing(false); }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
      <h2 className="text-lg font-bold">{portal.label}向け案内</h2>
      <a href={portal.url} className="mt-3 block break-all text-sm underline">{portal.url}</a>
      <div className="my-4 flex min-h-48 justify-center">
        {qr ? <img src={qr} alt={`${portal.label}ポータルのQRコード`} width={192} height={192} className="h-48 w-48" /> : <p className="self-center text-sm">QRコードを準備しています</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => void copy(portal.url)}>URLをコピー</button>
        <button type="button" className={buttonClass} onClick={() => void copy(guidance)}>案内文とURLをコピー</button>
        {qr && <a href={qr} download={`team-works-${portal.role}-qr.png`} className={buttonClass}>QR画像を保存</a>}
        {canShare && <button type="button" className={buttonClass} disabled={sharing} onClick={() => void share()}>共有する</button>}
      </div>
      <p role="status" className="mt-3 text-sm" aria-live="polite">{notice}</p>
      <label className="mt-4 block text-sm font-bold" htmlFor={`guide-${portal.role}`}>送る案内文</label>
      <textarea id={`guide-${portal.role}`} readOnly value={guidance} rows={7} className="mt-2 w-full rounded-xl border border-[var(--mikke-line)] p-3 text-sm leading-6" />
    </section>
  );
}

export function TeamWorksPortalShare() {
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-[var(--mikke-surface)] p-4 text-sm leading-6">先に本部から相手を招待してから、このURLをご案内ください。URLを送るだけではプロジェクトへの参加権限は付きません。</p>
      <div className="grid gap-5 lg:grid-cols-2">{TEAM_WORKS_PORTALS.map((portal) => <PortalCard key={portal.role} portal={portal} />)}</div>
      <p className="text-sm leading-6">「共有する」は対応する端末で表示されます。LINEが選べない場合は、案内文をコピーするかQR画像を保存して送ってください。</p>
    </div>
  );
}
