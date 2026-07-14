import { CalendarDays, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FundProgressSummary } from "./FundProgressSummary";
import { fundCampaignTypeLabels, fundProjectStatusLabels, type FundPlan, type FundProject } from "@/lib/fund/types";
import { normalizeFundExternalUrl } from "@/lib/fund/url";
import { formatDate, formatYen } from "@/lib/format";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";

export function FundProjectPublicView({ project, plans, preview = false }: { project: FundProject; plans: FundPlan[]; preview?: boolean }) {
  const activePlans = plans.filter((plan) => preview || (plan.status !== "draft" && plan.status !== "hidden"));
  const coverImageUrl = normalizeFundExternalUrl(project.coverImageUrl);
  const projectApplicationUrl = normalizeFundExternalUrl(project.externalApplicationUrl);
  const projectPaymentUrl = normalizeFundExternalUrl(project.externalPaymentUrl);

  return (
    <article>
      {preview ? (
        <p className="mb-4 rounded-lg border border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)] px-4 py-3 text-xs font-bold text-[var(--mikke-primary)]">
          プレビューです。このページは現在、この端末内だけで確認できます。
        </p>
      ) : null}

      {coverImageUrl ? (
        <div className="mb-5 aspect-[16/9] overflow-hidden rounded-lg bg-[var(--mikke-surface-soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <MikkeStatusBadge tone={project.status === "goal_reached" || project.status === "completed" ? "success" : "primary"} className="px-2 py-1">
          {fundProjectStatusLabels[project.status]}
        </MikkeStatusBadge>
        <span className="text-xs font-bold text-[var(--mikke-muted)]">{fundCampaignTypeLabels[project.campaignType]}</span>
      </div>

      <h1 className="mt-3 text-3xl font-bold leading-tight tracking-normal sm:text-4xl">{project.title}</h1>
      {project.shortDescription ? <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--mikke-text-soft)]">{project.shortDescription}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--mikke-muted)]">
        <Link href="/story" className="font-bold text-[var(--mikke-primary)]">この人のStoryを見る</Link>
        {project.endAt ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={14} />
            受付終了 {formatDate(project.endAt)}
          </span>
        ) : null}
      </div>

      <div className="mt-6">
        <FundProgressSummary project={project} publicView />
      </div>

      {activePlans.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold tracking-normal">応援方法を選ぶ</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {activePlans.map((plan) => {
              const applicationUrl = normalizeFundExternalUrl(plan.externalApplicationUrl) || projectApplicationUrl;
              const paymentUrl = normalizeFundExternalUrl(plan.externalPaymentUrl) || projectPaymentUrl;
              const actionUrl = applicationUrl || paymentUrl;
              return (
                <div key={plan.id} className="border-t border-[var(--mikke-line)] py-4 md:border md:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold">{plan.title}</h3>
                    {plan.price != null && project.displayAmount ? (
                      <span className="shrink-0 text-sm font-bold text-[var(--mikke-accent)]">{formatYen(plan.price)}</span>
                    ) : null}
                  </div>
                  {plan.description ? <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{plan.description}</p> : null}
                  {plan.quantityLimit ? <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">受付上限 {plan.quantityLimit}件</p> : null}
                  {actionUrl ? (
                    <a
                      href={actionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white"
                    >
                      外部ページで申し込む <ExternalLink size={16} />
                    </a>
                  ) : (
                    <p className="mt-4 rounded-lg bg-[var(--mikke-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--mikke-muted)]">
                      受付方法は実行者へお問い合わせください。
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--mikke-muted)]">
            <ShieldCheck size={15} className="mt-0.5 shrink-0" />
            申込・決済・返金はプロジェクト実行者が外部サービスで管理します。Mikkeが代金を預かることはありません。
          </p>
        </section>
      ) : null}

      <div className="mt-9 space-y-7">
        <PublicSection title="実現したいこと" body={project.description} />
        <PublicSection title="なぜ今、始めたいのか" body={project.whyNow} />
        <PublicSection title="この企画を届けたい人" body={project.audience} />
        <PublicSection title="応援によって実現すること" body={project.useOfSupport} />
        <PublicSection title="これからの予定" body={project.schedule} />
        <PublicSection title="リスク・変更の可能性" body={project.riskNotes} />
        <PublicSection title="中止・延期時の対応" body={project.cancellationPolicy} />
        <PublicSection title="お問い合わせ" body={project.contactNote} />
      </div>
    </article>
  );
}

function PublicSection({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <section className="border-t border-[var(--mikke-line)] pt-5">
      <h2 className="text-lg font-bold tracking-normal">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{body}</p>
    </section>
  );
}
