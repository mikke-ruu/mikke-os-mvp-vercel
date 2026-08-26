"use client";

import { AlertTriangle, Check, ChevronDown, Copy, Eye, EyeOff, KeyRound, LogOut, Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthGate";
import { getJapaneseAuthError } from "@/lib/mikkeos/auth-errors";
import { supabase } from "@/lib/supabase/client";
import { ManagerShell } from "./ManagerShell";

type Notice = { type: "success" | "error"; text: string } | null;

const inputClassName =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-primary-border)]";
const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--mikke-text)] disabled:cursor-not-allowed disabled:opacity-50";

function StatusNotice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p
      role={notice.type === "error" ? "alert" : "status"}
      className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
        notice.type === "error"
          ? "border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-danger)]"
          : "border border-[var(--mikke-line)] bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]"
      }`}
    >
      {notice.text}
    </p>
  );
}

function AccountDisclosure({
  icon: Icon,
  title,
  summary,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-[var(--mikke-line)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden sm:px-6 sm:py-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--mikke-line)] text-[var(--mikke-blue)]">
            <Icon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[var(--mikke-text)] sm:text-base">{title}</span>
            <span className="block truncate text-xs font-semibold text-[var(--mikke-muted)]">{summary}</span>
          </span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-[var(--mikke-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 sm:px-6 sm:pb-6">{children}</div>
    </details>
  );
}

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("same password")) return "現在と異なるパスワードを入力してください。";
  if (normalized.includes("current password") || normalized.includes("reauthentication")) {
    return "現在のパスワードを確認できませんでした。入力を確認し、必要であればログインし直してからお試しください。";
  }
  if (normalized.includes("email address") && normalized.includes("already")) return "このメールアドレスはすでに使用されています。";
  return getJapaneseAuthError(message);
}

export function ManagerProfilePanel({ mikkeIdChangeEnabled }: { mikkeIdChangeEnabled: boolean }) {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [displayNameNotice, setDisplayNameNotice] = useState<Notice>(null);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [mikkeId, setMikkeId] = useState(profile.handle ?? "");
  const [mikkeIdConfirmationOpen, setMikkeIdConfirmationOpen] = useState(false);
  const [mikkeIdConfirmed, setMikkeIdConfirmed] = useState(false);
  const [mikkeIdNotice, setMikkeIdNotice] = useState<Notice>(null);
  const [savingMikkeId, setSavingMikkeId] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState(user.email ?? "");
  const [emailNotice, setEmailNotice] = useState<Notice>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutNotice, setSignOutNotice] = useState<Notice>(null);

  async function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDisplayName = displayName.trim();
    setDisplayNameNotice(null);
    if (!nextDisplayName) {
      setDisplayNameNotice({ type: "error", text: "表示名を入力してください。" });
      return;
    }

    setSavingDisplayName(true);
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({ display_name: nextDisplayName })
      .eq("id", profile.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !updatedProfile) {
      setDisplayNameNotice({ type: "error", text: "表示名を保存できませんでした。時間をおいてもう一度お試しください。" });
    } else {
      await refreshProfile();
      setDisplayName(nextDisplayName);
      setDisplayNameNotice({ type: "success", text: "表示名を保存しました。" });
    }
    setSavingDisplayName(false);
  }

  async function copyMikkeId() {
    if (!profile.handle) return;
    try {
      await navigator.clipboard.writeText(profile.handle);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMikkeIdNotice({ type: "error", text: "コピーできませんでした。mikke IDを選択してコピーしてください。" });
    }
  }

  async function saveMikkeId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMikkeIdNotice(null);
    if (!mikkeIdChangeEnabled) {
      setMikkeIdNotice({ type: "error", text: "mikke IDの変更は、専用RPCの本番適用後に利用できます。" });
      return;
    }
    if (!mikkeIdConfirmed) {
      setMikkeIdNotice({ type: "error", text: "公開URLが変わることを確認してください。" });
      return;
    }

    setSavingMikkeId(true);
    const { error } = await supabase.rpc("mikke_update_my_mikke_id", { p_handle: mikkeId.trim() });
    if (error) {
      setMikkeIdNotice({ type: "error", text: error.message || "mikke IDを変更できませんでした。" });
    } else {
      await refreshProfile();
      setMikkeIdConfirmed(false);
      setMikkeIdConfirmationOpen(false);
      setMikkeIdNotice({ type: "success", text: "mikke IDを変更しました。新しい公開URLをご確認ください。" });
    }
    setSavingMikkeId(false);
  }

  function openMikkeIdConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMikkeId = mikkeId.trim();
    setMikkeIdNotice(null);
    if (!nextMikkeId) {
      setMikkeIdNotice({ type: "error", text: "新しいmikke IDを入力してください。" });
      return;
    }
    if (nextMikkeId === profile.handle) {
      setMikkeIdNotice({ type: "error", text: "現在と異なるmikke IDを入力してください。" });
      return;
    }
    setMikkeId(nextMikkeId);
    setMikkeIdConfirmed(false);
    setMikkeIdConfirmationOpen(true);
  }

  function closeMikkeIdConfirmation() {
    setMikkeIdConfirmed(false);
    setMikkeIdConfirmationOpen(false);
    setMikkeIdNotice(null);
  }

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    setEmailNotice(null);
    if (!nextEmail || nextEmail === user.email) {
      setEmailNotice({ type: "error", text: nextEmail ? "現在と異なるメールアドレスを入力してください。" : "メールアドレスを入力してください。" });
      return;
    }

    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    setEmailNotice(
      error
        ? { type: "error", text: authErrorMessage(error.message) }
        : { type: "success", text: "確認メールを送信しました。メール内の案内に沿って変更を完了してください。" }
    );
    setSavingEmail(false);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordNotice(null);
    if (!currentPassword) {
      setPasswordNotice({ type: "error", text: "現在のパスワードを入力してください。" });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordNotice({ type: "error", text: "新しいパスワードは8文字以上で入力してください。" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: "error", text: "新しいパスワードが一致していません。" });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
    if (error) {
      setPasswordNotice({ type: "error", text: authErrorMessage(error.message) });
    } else {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice({ type: "success", text: "パスワードを変更しました。" });
    }
    setSavingPassword(false);
  }

  async function signOut() {
    setSignOutNotice(null);
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      setSignOutNotice({ type: "error", text: "ログアウトできませんでした。通信状態を確認してもう一度お試しください。" });
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <ManagerShell title="基本情報" subtitle="表示名、mikke ID、ログイン情報を管理します。">
      <div className="overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-white shadow-sm sm:rounded-2xl">
        <header className="border-b-[3px] border-b-[var(--mikke-yellow)] p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--mikke-surface-soft)] text-[var(--mikke-primary)]">
              <UserRound size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-[var(--mikke-text)]">{profile.display_name || "名前未設定"}</h2>
              <p className="truncate text-sm font-semibold text-[var(--mikke-muted)]">
                {profile.handle ? `@${profile.handle}` : "mikke ID未設定"} ・ {user.email ?? "メールアドレス未設定"}
              </p>
            </div>
          </div>
        </header>

        <AccountDisclosure icon={UserRound} title="表示名" summary={profile.display_name || "名前未設定"}>
          <p className="text-sm text-[var(--mikke-muted)]">mikkeOS内であなたの名前として表示されます。</p>
          <form onSubmit={saveDisplayName} className="mt-3 max-w-xl">
            <label className="grid gap-2">
              <span className="text-sm font-bold">表示名</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" className={inputClassName} />
            </label>
            <button type="submit" disabled={savingDisplayName} className={`${primaryButtonClassName} mt-3`}>
              {savingDisplayName ? "保存中…" : "表示名を保存"}
            </button>
            <StatusNotice notice={displayNameNotice} />
          </form>
        </AccountDisclosure>

        <section className="border-b border-[var(--mikke-line)] border-l-[3px] border-l-[var(--mikke-orange)] p-4 sm:p-6">
          <h2 className="text-base font-bold text-[var(--mikke-text)]">mikke ID</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--mikke-muted)]">
            mikkeの各アプリで共通して使う、あなた専用のIDです。公開ページのURLなど、mikke内のさまざまな場所につながります。
          </p>
          <div className="mt-3 flex max-w-xl items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-2.5 text-sm font-bold text-[var(--mikke-text)]">
              {profile.handle ? `@${profile.handle}` : "未設定"}
            </code>
            <button type="button" onClick={copyMikkeId} disabled={!profile.handle} className={secondaryButtonClassName}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "コピー済み" : "コピー"}
            </button>
          </div>

          {!mikkeIdChangeEnabled ? (
            <p className="mt-3 max-w-xl rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-xs font-semibold text-[var(--mikke-muted)] sm:text-sm">
              mikke IDの変更は準備中です。現在は表示とコピーのみ利用できます。
            </p>
          ) : mikkeIdConfirmationOpen ? (
            <form onSubmit={saveMikkeId} className="mt-5 max-w-xl">
              <div className="rounded-xl border border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)] p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><AlertTriangle size={17} />変更前にご確認ください</p>
                <p className="mt-2 text-sm leading-6 text-[var(--mikke-text)]">
                  mikke IDを変更すると、StoryとFundの公開ページURLも同時に変わります。以前のURLは転送されません。名刺・QRコード・SNS・配布物などに掲載したURLは、変更後のURLへ差し替えてください。
                </p>
              </div>
              <dl className="mt-4 grid gap-3 rounded-xl border border-[var(--mikke-line)] p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold text-[var(--mikke-muted)]">変更前のmikke ID</dt>
                  <dd className="mt-1 break-all text-sm font-bold text-[var(--mikke-text)]">{profile.handle ? `@${profile.handle}` : "未設定"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-[var(--mikke-muted)]">変更後のmikke ID</dt>
                  <dd className="mt-1 break-all text-sm font-bold text-[var(--mikke-primary)]">@{mikkeId}</dd>
                </div>
              </dl>
              <label className="mt-4 flex items-start gap-2 text-sm font-semibold text-[var(--mikke-text)]">
                <input type="checkbox" checked={mikkeIdConfirmed} onChange={(event) => setMikkeIdConfirmed(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--mikke-accent)]" />
                公開URLが変わることを確認しました
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={closeMikkeIdConfirmation} disabled={savingMikkeId} className={secondaryButtonClassName}>入力へ戻る</button>
                <button type="submit" disabled={savingMikkeId || !mikkeIdConfirmed} className={primaryButtonClassName}>
                  {savingMikkeId ? "変更中…" : "mikke IDを変更"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={openMikkeIdConfirmation} className="mt-5 max-w-xl">
              <label className="grid gap-2">
                <span className="text-sm font-bold">新しいmikke ID</span>
                <input value={mikkeId} onChange={(event) => setMikkeId(event.target.value)} autoCapitalize="none" autoComplete="off" spellCheck={false} className={inputClassName} />
              </label>
              <button type="submit" className={`${primaryButtonClassName} mt-4`}>変更内容を確認</button>
            </form>
          )}
          <StatusNotice notice={mikkeIdNotice} />
        </section>

        <AccountDisclosure icon={Mail} title="メールアドレス" summary={user.email ?? "メールアドレス未設定"}>
          <p className="text-sm text-[var(--mikke-muted)]">ログインや大切なお知らせに使います。変更時は確認メールが届きます。</p>
          <form onSubmit={saveEmail} className="mt-3 max-w-xl">
            <label className="grid gap-2">
              <span className="text-sm font-bold">新しいメールアドレス</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className={inputClassName} />
            </label>
            <button type="submit" disabled={savingEmail} className={`${primaryButtonClassName} mt-3`}>
              {savingEmail ? "送信中…" : "確認メールを送る"}
            </button>
            <StatusNotice notice={emailNotice} />
          </form>
        </AccountDisclosure>

        <AccountDisclosure icon={KeyRound} title="パスワード" summary="必要なときだけ変更できます">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--mikke-muted)]">現在のパスワードを使って変更します。</p>
            <button
              type="button"
              onClick={() => setShowPasswords((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-[var(--mikke-muted)]"
              aria-pressed={showPasswords}
            >
              {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
              {showPasswords ? "隠す" : "表示する"}
            </button>
          </div>
          <form onSubmit={savePassword} className="mt-3 grid max-w-xl gap-3">
            <label className="grid gap-2">
              <span className="text-sm font-bold">現在のパスワード</span>
              <input type={showPasswords ? "text" : "password"} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className={inputClassName} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold">新しいパスワード（8文字以上）</span>
              <input type={showPasswords ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" className={inputClassName} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold">新しいパスワード（確認）</span>
              <input type={showPasswords ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" className={inputClassName} />
            </label>
            <button type="submit" disabled={savingPassword} className={`${primaryButtonClassName} mt-1 w-fit`}>
              {savingPassword ? "変更中…" : "パスワードを変更"}
            </button>
            <StatusNotice notice={passwordNotice} />
          </form>
        </AccountDisclosure>

        <AccountDisclosure icon={LogOut} title="ログアウト" summary="この端末からログアウトします">
          <button type="button" onClick={signOut} disabled={signingOut} className={secondaryButtonClassName}>
            <LogOut size={17} />
            {signingOut ? "ログアウト中…" : "ログアウト"}
          </button>
          <StatusNotice notice={signOutNotice} />
        </AccountDisclosure>
      </div>
    </ManagerShell>
  );
}
