"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { getJapaneseAuthError } from "@/lib/mikkeos/auth-errors";
import { supabase } from "@/lib/supabase/client";

type PageMode = "checking" | "request" | "recovery" | "invalid" | "complete";

const inputClassName =
  "w-full rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-3 outline-none focus:border-[var(--mikke-accent)]";

function recoveryErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("token") ||
    normalized.includes("session")
  ) {
    return "再設定リンクの有効期限が切れているか、すでに使用されています。再設定メールをもう一度送ってください。";
  }
  return getJapaneseAuthError(message);
}

export default function ResetPasswordPage() {
  const [mode, setMode] = useState<PageMode>("checking");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let active = true;
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const fragmentError = fragment.get("error_description") ?? fragment.get("error");
    const recoveryInUrl = fragment.get("type") === "recovery";

    if (fragmentError) {
      setMessage(recoveryErrorMessage(fragmentError));
      setMode("invalid");
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setMessage("");
        setMode("recovery");
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || fragmentError) return;
      if (error) {
        setMessage(recoveryErrorMessage(error.message));
        setMode("invalid");
        return;
      }
      if (recoveryInUrl && data.session) {
        setMode("recovery");
        return;
      }
      setMode("request");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setLoading(false);

    if (error) {
      setMessage(getJapaneseAuthError(error.message));
      return;
    }

    setEmail("");
    setResendCooldown(60);
    setMessage(
      "入力したメールアドレスが登録されている場合、再設定メールを送信しました。迷惑メールフォルダもご確認ください。"
    );
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (newPassword.length < 8) {
      setMessage("新しいパスワードは8文字以上で入力してください。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("新しいパスワードが一致していません。");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setLoading(false);
      setMessage(recoveryErrorMessage(error.message));
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
    setMode("complete");
  }

  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)] px-4 py-8 text-[var(--mikke-text)] sm:px-5 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl gap-8 md:min-h-[calc(100vh-5rem)] md:grid-cols-[1fr_420px] md:items-center">
        <section className="self-end md:self-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mikke-accent)]">MIKKE</p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-[var(--mikke-primary)] sm:text-4xl">パスワード再設定</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--mikke-muted)]">
            mikke IDひとつで、mikkeのすべてのアプリが使えます。
          </p>
        </section>

        <section className="self-start rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 shadow-sm sm:p-6 md:self-auto">
          {mode === "checking" ? (
            <p className="py-8 text-center text-sm font-bold text-[var(--mikke-muted)]" role="status">再設定リンクを確認しています…</p>
          ) : null}

          {mode === "request" || mode === "invalid" ? (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]">
                <Mail size={22} />
              </span>
              <h2 className="mt-4 text-center text-xl font-bold text-[var(--mikke-primary)]">再設定メールを受け取る</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">
                登録に使ったメールアドレスを入力してください。新しいパスワードを設定するためのメールを送ります。
              </p>

              {message ? (
                <p className="mt-4 rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm leading-6 text-[var(--mikke-accent-strong)]" role="status">
                  {message}
                </p>
              ) : null}

              <form onSubmit={requestReset} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-bold">メールアドレス</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    required
                    className={`mt-2 ${inputClassName}`}
                  />
                </label>
                <button type="submit" disabled={loading || resendCooldown > 0} className="w-full rounded-lg bg-[var(--mikke-primary)] px-4 py-3 font-bold text-white disabled:opacity-60">
                  {loading ? "送信中…" : resendCooldown > 0 ? `もう一度送る（あと${resendCooldown}秒）` : "再設定メールを送る"}
                </button>
              </form>
              <Link href="/login" className="mt-4 block text-center text-sm font-bold text-[var(--mikke-primary)] underline underline-offset-4">
                ログイン画面へ戻る
              </Link>
            </>
          ) : null}

          {mode === "recovery" ? (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]">
                <KeyRound size={22} />
              </span>
              <h2 className="mt-4 text-center text-xl font-bold text-[var(--mikke-primary)]">新しいパスワードを設定</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">8文字以上の新しいパスワードを入力してください。</p>

              <form onSubmit={updatePassword} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-bold">新しいパスワード</span>
                  <span className="relative mt-2 block">
                    <input
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className={`${inputClassName} pr-12`}
                    />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示する"} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--mikke-muted)]">
                      {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </span>
                </label>

                <label className="block">
                  <span className="text-sm font-bold">新しいパスワード（確認）</span>
                  <span className="relative mt-2 block">
                    <input
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className={`${inputClassName} pr-12`}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "確認用パスワードを隠す" : "確認用パスワードを表示する"} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--mikke-muted)]">
                      {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </span>
                </label>

                {message ? (
                  <p className="rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm leading-6 text-[var(--mikke-accent-strong)]" role="alert">
                    {message}
                  </p>
                ) : null}

                <button type="submit" disabled={loading} className="w-full rounded-lg bg-[var(--mikke-primary)] px-4 py-3 font-bold text-white disabled:opacity-60">
                  {loading ? "変更中…" : "パスワードを変更する"}
                </button>
              </form>
            </>
          ) : null}

          {mode === "complete" ? (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]">
                <KeyRound size={22} />
              </span>
              <h2 className="mt-4 text-center text-xl font-bold text-[var(--mikke-primary)]">パスワードを変更しました</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">
                この画面を閉じ、ホーム画面のmikkeOSまたは普段使っているブラウザを開いて、新しいパスワードでログインしてください。
              </p>
              <Link href="/login" className="mt-5 block w-full rounded-lg bg-[var(--mikke-primary)] px-4 py-3 text-center font-bold text-white">
                ログイン画面へ
              </Link>
            </>
          ) : null}

          <p className="mt-5 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">by mikke</p>
        </section>
      </div>
    </main>
  );
}
