import Link from "next/link";

export function MediaPublicFooter({ name, articlePath }: { name: string; articlePath?: string }) {
  const revision = process.env.NEXT_PUBLIC_MEDIA_LEGAL_REVISION ?? "";
  const legalPath = /^[a-z0-9-]{1,80}$/.test(revision) ? `/legal/media/${revision}` : null;
  const email = "musubi.aroma@gmail.com";
  const contact = `mailto:${email}?` + new URLSearchParams({
    subject: "Media Free 通報",
    body: `対象の記事：${articlePath ?? ""}\n\nご連絡の内容：\n\n返信先：`,
  }).toString();

  return <footer className="border-t border-[var(--mikke-line)] px-5 py-8 text-center text-xs leading-7 text-[var(--mikke-muted)]">
    <p>{name} · Media by mikke</p>
    <nav className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1" aria-label="運営と利用条件">
      {legalPath ? <Link href={legalPath} className="underline">利用条件・プライバシー・禁止事項</Link> : <span>利用条件を準備中</span>}
      <a href={contact} className="underline">通報・訂正・お問い合わせ</a>
      <Link href="/legal/commercial-disclosure/2026-09-04-v1" className="underline">運営会社</Link>
    </nav>
    <p className="mt-2">連絡先：<a href={`mailto:${email}`} className="underline">{email}</a></p>
    {process.env.NODE_ENV === "development" ? <p className="mt-2">開発環境の表示です。</p> : null}
  </footer>;
}
