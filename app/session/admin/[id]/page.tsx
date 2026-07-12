"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, ListChecks } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { SessionMenuForm } from "@/components/session/SessionMenuForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { formatYen } from "@/lib/format";
import { useSessionMenus } from "@/lib/session/store";

function SessionAdminMenuDetailContent() {
  const params = useParams<{ id: string }>();
  const { menus, bookings } = useSessionMenus();
  const menu = menus.find((item) => item.id === params.id);
  const [editing, setEditing] = useState(false);

  if (!menu) {
    return (
      <MikkeAppShell appName="Session" title="Session" currentApp={{ label: "Session", href: "/apps/session" }} footerLabel="Session by mikke">
        <p className="text-sm text-[var(--mikke-muted)]">このメニューは見つかりませんでした。</p>
      </MikkeAppShell>
    );
  }

  const menuBookings = bookings.filter((booking) => booking.menuId === menu.id);

  return (
    <MikkeAppShell appName="Session" title={menu.title} currentApp={{ label: "Session", href: "/apps/session" }} footerLabel="Session by mikke">
      {editing ? (
        <div>
          <button type="button" onClick={() => setEditing(false)} className="mb-3 text-xs font-bold text-[var(--mikke-muted)]">
            ← 詳細に戻る
          </button>
          <SessionMenuForm menu={menu} />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <MikkeStatusBadge tone={menu.published ? "primary" : "muted"}>{menu.published ? "公開中" : "非公開"}</MikkeStatusBadge>
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-[var(--mikke-accent)]">
              編集する
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/session/${menu.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)]"
            >
              <ExternalLink size={14} />
              公開ページを見る
            </Link>
            <Link
              href="/session/admin/bookings"
              className="inline-flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white shadow-sm"
            >
              <ListChecks size={14} />
              このメニューの予約（{menuBookings.length}）
            </Link>
          </div>

          <div className="mt-5 space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 text-sm text-[var(--mikke-text-soft)]">
            <p>所要時間：{menu.durationLabel}</p>
            <p>料金：{menu.priceLabel}{menu.price != null ? `（${formatYen(menu.price)}）` : ""}</p>
            {menu.availabilityNote ? <p>対応可能時間：{menu.availabilityNote}</p> : null}
          </div>

          {menu.summary ? <p className="mt-4 text-sm leading-6 text-[var(--mikke-text-soft)]">{menu.summary}</p> : null}
        </div>
      )}
    </MikkeAppShell>
  );
}

export default function SessionAdminMenuDetailPage() {
  return (
    <AuthGate>
      <SessionAdminMenuDetailContent />
    </AuthGate>
  );
}
