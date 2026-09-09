import Link from "next/link";

export function MediaPublicFooter({ name, articlePath }: { name: string; articlePath?: string }) {
  const email = "musubi.aroma@gmail.com";
  const contact = `mailto:${email}?` + new URLSearchParams({
    subject: "Media Free 通報",
    body: `対象の記事：${articlePath ?? ""}\n\nご連絡の内容：\n\n返信先：`,
  }).toString();

  return <footer className="border-t border-[var(--mikke-line)] px-5 py-8 text-center text-xs leading-7 text-[var(--mikke-muted)]">
    <p>{name} · Media by mikke</p>
    <nav className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1" aria-label="運営と利用条件">
      <Link href="/legal/media/free/terms/2026-09-09-v1" className="underline">利用条件</Link>
      <Link href="/legal/media/free/privacy/2026-09-09-v1" className="underline">プライバシー</Link>
      <Link href="/legal/media/free/content-publication/2026-09-09-v1" className="underline">投稿ルール</Link>
      <Link href="/legal/media/free/report-data/2026-09-09-v1" className="underline">削除・保存</Link>
      <a href={contact} className="underline">通報・訂正・お問い合わせ</a>
      <Link href="/legal/commercial-disclosure/2026-09-04-v1" className="underline">運営会社</Link>
    </nav>
    <p className="mt-2">連絡先：<a href={`mailto:${email}`} className="underline">{email}</a></p>
    {process.env.NODE_ENV === "development" ? <p className="mt-2">開発環境の表示です。</p> : null}
  </footer>;
}
