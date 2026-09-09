import Link from "next/link";
import type { AcademyHeadquartersAccess } from "@/types/database";

function deadline(value: string | null) {
  if (!value || Number.isNaN(new Date(value).getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function AcademyUsageStatus({ access, sample, href }: { access: AcademyHeadquartersAccess | null; sample: boolean; href: string }) {
  const until = deadline(access?.ends_at ?? null);
  const trial = access?.access_kind === "trial";
  const usable = access?.can_manage_drafts === true;
  const title = !access ? (sample ? "サンプル表示" : "利用状態を確認してください")
    : trial ? (usable ? "7日間無料体験中" : "無料体験は終了しました")
    : access.status === "internal_grant" && usable ? "利用可能（付与された利用権）"
    : access.status === "active" && usable ? "有料利用中"
    : access.status === "past_due" ? "お支払い状況の確認が必要です"
    : usable ? "利用可能" : "現在は閲覧のみです";
  return <section aria-label="Academyの利用状態" className="mb-2 border-b border-[var(--mikke-line)] pb-2">
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
      <span className={`rounded-md border px-2 py-1 text-xs font-bold ${trial ? "border-[#ffd370]" : "border-[#8bc7ad]"}`}>{title}</span>
      {until ? <span className="text-xs">{until}まで</span> : null}
      <Link href={href} className="ml-auto inline-flex min-h-11 shrink-0 items-center text-xs text-[var(--mikke-primary)]">利用状態・料金を確認 →</Link>
    </div>
    <details className="text-xs text-[var(--mikke-muted)]"><summary className="w-fit cursor-pointer py-1">{sample ? "確認用データについて" : "利用期間について"}</summary>
      {access ? <p className="mt-1 leading-5">{until ? `${trial ? "無料体験" : "利用期間"}：${until}まで（日本時間）` : "利用期限：設定なし"}{trial && usable ? ` · あと${Math.max(0, access.days_remaining)}日` : ""}</p> : null}
      <p className="mt-1 leading-5">{sample ? "確認用データです。実際の契約状態ではありません。" : trial ? "無料期間の終了だけでは自動課金されません。" : "利用期間は公開中の講座数ではなく、利用契約・利用権で決まります。"}</p>
    </details>
  </section>;
}
