import Link from "next/link";
import { ArrowRight, Plus, Users } from "lucide-react";
import { communityBasePath } from "@/lib/community/routes";
import type { Community } from "@/lib/community/types";

export function CommunityDirectory({ communities, organizer, userId }: {
  communities: Community[]; organizer: boolean; userId: string;
}) {
  return <>
    <nav aria-label="Communityの一覧" className="mt-6 flex flex-wrap gap-2 text-sm font-bold">
      <Link href="/community" aria-current={!organizer ? "page" : undefined} className="rounded-lg border border-[var(--mikke-line)] px-4 py-3 aria-[current=page]:bg-[var(--mikke-primary)] aria-[current=page]:text-white">参加中</Link>
      <Link href="/community/manage" aria-current={organizer ? "page" : undefined} className="rounded-lg border border-[var(--mikke-line)] px-4 py-3 aria-[current=page]:bg-[var(--mikke-primary)] aria-[current=page]:text-white">運営中</Link>
      <Link href="/community/start" className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-white"><Plus size={16} aria-hidden="true" />新しく作る</Link>
    </nav>
    <h2 className="mt-6 text-xl font-bold">{organizer ? "運営中のCommunity" : "参加中のCommunity"}</h2>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {communities.map((community) => {
        const base = communityBasePath(community.slug);
        return <article key={community.id} className="min-w-0 rounded-xl border border-[var(--mikke-line)] bg-white p-4">
          <Link href={organizer ? `${base}/owner` : base} className="block rounded-lg">
            <div className="flex items-center gap-3">
              {community.logoUrl ? <img src={community.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <Users size={24} aria-hidden="true" className="shrink-0 text-[var(--mikke-primary)]" />}
              <h3 className="min-w-0 flex-1 break-words font-bold">{community.name}</h3>
              <ArrowRight size={17} aria-hidden="true" className="shrink-0" />
            </div>
            <p className="mt-2 break-all text-xs text-[var(--mikke-muted)]">/community/c/{community.slug}</p>
            {community.description ? <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-[var(--mikke-muted)]">{community.description}</p> : null}
          </Link>
          {organizer ? <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--mikke-line)] pt-3 text-sm">
            <span className="text-xs text-[var(--mikke-muted)]">{community.ownerUserId === userId ? "オーナー" : "モデレーター"}</span>
            <Link href={base} className="py-2 font-bold text-[var(--mikke-primary)]">Communityを開く</Link>
            {community.ownerUserId === userId ? <Link href={`/community/platform-billing?resourceId=${encodeURIComponent(community.id)}`} className="py-2 font-bold text-[var(--mikke-primary)]">このCommunityの利用プラン</Link> : null}
          </div> : null}
        </article>;
      })}
    </div>
    {communities.length === 0 ? <section className="mt-5 rounded-xl border border-dashed border-[var(--mikke-line)] p-5">
      <h3 className="font-bold">{organizer ? "運営中のCommunityはありません" : "参加中のCommunityはありません"}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{organizer ? "「新しく作る」から団体のCommunityを作れます。" : "参加するには団体から届いた参加URLを開いてください。"}</p>
    </section> : null}
  </>;
}
