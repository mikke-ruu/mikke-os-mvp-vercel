"use client";

import { CheckCircle2, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { acceptTeamWorksMemberInvite, type TeamWorksInviteRole } from "@/lib/team-works-database";

const allowedRoles: TeamWorksInviteRole[] = ["manager", "client_user", "worker"];

export function TeamWorksInviteAccept() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const organizationId = searchParams.get("organization") ?? "";
  const roleValue = searchParams.get("role") ?? "";
  const role = allowedRoles.includes(roleValue as TeamWorksInviteRole) ? roleValue as TeamWorksInviteRole : null;
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const validLink = Boolean(inviteId && organizationId && role);

  async function acceptInvite() {
    if (!validLink || !role) return;
    setBusy(true);
    setErrorMessage("");
    try {
      await acceptTeamWorksMemberInvite({
        inviteId,
        organizationId,
        role,
        displayName: profile.display_name
      });
      setAccepted(true);
    } catch (error) {
      setErrorMessage(toInviteErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <MikkeAppShell
      appName="Team Works"
      title="案件への招待"
      subtitle="ログイン中のアカウントで招待を受け取ります"
      currentApp={{ label: "Team", href: "/apps/team-works" }}
      footerLabel="Team Works by mikke"
    >
      <div className="mx-auto max-w-xl rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 sm:p-7">
        {accepted ? (
          <div className="text-center">
            <CheckCircle2 size={42} className="mx-auto text-emerald-600" />
            <h2 className="mt-4 text-lg font-bold">案件へ参加しました</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
              Team Worksのメンバー情報と案件権限が登録されました。
            </p>
            <Link href={postAcceptHref(role)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white">
              {postAcceptLabel(role)}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[var(--mikke-primary-soft)] p-2 text-[var(--mikke-primary)]"><ShieldCheck size={22} /></span>
              <div>
                <h2 className="font-bold">招待内容を確認</h2>
                <p className="mt-1 text-xs text-[var(--mikke-muted)]">ログイン中: {user.email ?? "メールアドレス未設定"}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 rounded-xl bg-[var(--mikke-bg)] p-4 text-sm">
              <div className="flex items-center justify-between gap-4"><dt className="text-[var(--mikke-muted)]">表示名</dt><dd className="font-bold">{profile.display_name}</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-[var(--mikke-muted)]">役割</dt><dd className="font-bold">{role ? roleLabel(role) : "確認できません"}</dd></div>
            </dl>
            {!validLink ? <p role="alert" className="mt-4 text-sm font-bold text-red-600">招待リンクが不完全です。招待した方にリンクの再発行を依頼してください。</p> : null}
            {errorMessage ? <p role="alert" className="mt-4 text-sm font-bold leading-6 text-red-600">{errorMessage}</p> : null}
            <button type="button" onClick={acceptInvite} disabled={busy || !validLink} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {busy ? <LoaderCircle size={17} className="animate-spin" /> : <LogIn size={17} />}
              この案件に参加する
            </button>
            <p className="mt-3 text-xs leading-5 text-[var(--mikke-muted)]">
              招待先と同じメールアドレスのアカウントだけが参加できます。リンクには有効期限があり、1回だけ利用できます。
            </p>
          </>
        )}
      </div>
    </MikkeAppShell>
  );
}

function roleLabel(role: TeamWorksInviteRole) {
  if (role === "manager") return "管理者";
  if (role === "client_user") return "クライアント";
  return "担当メンバー";
}

// 受諾後の遷移先は役割で分ける。/apps/team-works/projects は本部(owner/manager)専用の
// 管理画面のため、worker/client_user をそこへ送ると「まだありません」の空表示になり紛らわしい。
function postAcceptHref(role: TeamWorksInviteRole | null) {
  if (role === "worker") return "/apps/team-works/portal/worker";
  if (role === "client_user") return "/apps/team-works/portal/client";
  return "/apps/team-works/projects";
}

function postAcceptLabel(role: TeamWorksInviteRole | null) {
  if (role === "worker") return "自分の担当を見る";
  if (role === "client_user") return "学校ポータルを開く";
  return "案件一覧を開く";
}

function toInviteErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error && typeof (error as { message: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  if (message.includes("row-level security") || message.includes("policy")) {
    return "このアカウントでは招待を受け取れません。招待メール、有効期限、利用済みでないことを確認してください。";
  }
  return message || "招待を受け取れませんでした。時間をおいて再度お試しください。";
}
