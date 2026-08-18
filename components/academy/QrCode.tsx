"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import QRCode from "qrcode";

// 営業用URLをQRコード化して表示・PNGダウンロードできる共通部品。
// 名刺・チラシ用に印刷しやすいよう、余白ありの大きめPNGを生成する。
export function QrCode({ url, filename }: { url: string; filename: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setFailed(false);
    QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: { dark: "#25211fff", light: "#ffffffff" }
    }).then((d) => {
      if (active) setDataUrl(d);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [url]);

  if (failed) return <p className="w-32 text-center text-[10px] text-[var(--mikke-danger)]">QRコードを生成できませんでした。</p>;
  if (!dataUrl) return <div className="h-32 w-32 animate-pulse rounded-xl bg-[var(--mikke-surface-soft)]" />;

  return (
    <div className="flex flex-col items-center gap-2">
      <img src={dataUrl} alt="QRコード" className="h-32 w-32 rounded-xl border border-[var(--mikke-line)] bg-white p-2" />
      <a
        href={dataUrl}
        download={`${filename}.png`}
        className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]"
      >
        <Download size={13} /> QRコードを保存
      </a>
    </div>
  );
}
