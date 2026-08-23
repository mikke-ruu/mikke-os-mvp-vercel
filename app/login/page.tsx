"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getJapaneseAuthError } from "@/lib/mikkeos/auth-errors";
import { markLoginDestinationAsOwned } from "@/lib/mikkeos/app-ownership";
import { saveEmailPreferences } from "@/lib/email-preferences";
import { sendWelcomeEmail } from "@/lib/email-delivery";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

type PasswordStrength = {
  level: 0 | 1 | 2;
  label: string;
  guidance: string;
};

const passwordStrengthLabels = ["低（もう少し）", "中（安心）", "高（より安心）"] as const;
const passwordStrengthBarClasses = ["bg-[var(--mikke-pink)]", "bg-[var(--mikke-yellow)]", "bg-[var(--mikke-green)]"] as const;

function getPasswordStrength(password: string, email: string): PasswordStrength {
  const normalized = password.toLowerCase();
  const emailName = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const characterGroups = [/[a-z]/i, /\d/, /[^a-z\d]/i].filter((pattern) => pattern.test(password)).length;
  const hasGuessablePattern =
    /^\d+$/.test(password) ||
    /(.)\1{2,}/.test(normalized) ||
    /(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwerty|password|pass|admin|mikke)/.test(normalized) ||
    /(?:19|20)\d{2}/.test(normalized) ||
    /(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/.test(normalized) ||
    (emailName.length >= 4 && normalized.includes(emailName));

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 10) points += 1;
  if (password.length >= 12) points += 1;
  if (characterGroups >= 2) points += 1;
  if (characterGroups >= 3) points += 1;
  if (hasGuessablePattern) points = Math.max(0, points - 2);

  if (password.length >= 10 && points >= 4 && !hasGuessablePattern) {
    return { level: 2, label: passwordStrengthLabels[2], guidance: "推測されにくいパスワードです。" };
  }
  if (password.length >= 8 && points >= 2) {
    return { level: 1, label: passwordStrengthLabels[1], guidance: "推測されにくい組み合わせです。" };
  }
  return {
    level: 0,
    label: passwordStrengthLabels[0],
    guidance: password.length < 8 ? "8文字以上で入力してください。" : "名前や誕生日、連続した文字を避けると安心です。"
  };
}

const loginDestinations = [
  { prefix: "/story", eyebrow: "STORY", title: "Storyをつくる", description: "mikke IDひとつで、Storyとmikkeのすべてのアプリが使えます。" },
  { prefix: "/marketnote", eyebrow: "MARKETNOTE", title: "MarketNoteをはじめる", description: "mikke IDひとつで、MarketNoteとmikkeのすべてのアプリが使えます。" }
] as const;

function safeNextPath(value: string | null) {
  if (!value) return "/home";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

function getLoginDestination(nextPath: string) {
  if (nextPath.startsWith("/story/") && nextPath.includes("collect=1")) {
    return {
      prefix: "/story",
      eyebrow: "STORY",
      title: "このSTORYを保存する",
      description: "ログインまたは新規登録のあと、開いていたSTORYをコレクションへ保存します。"
    };
  }
  return loginDestinations.find((destination) => nextPath.startsWith(destination.prefix)) ?? {
    prefix: "",
    eyebrow: "MIKKE",
    title: "mikkeをはじめる",
    description: "mikke IDひとつで、mikkeのすべてのアプリが使えます。"
  };
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const destination = getLoginDestination(nextPath);
  const showMarketNoteGuestEntry = nextPath.startsWith("/marketnote");
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailUpdatesOptIn, setEmailUpdatesOptIn] = useState(false);
  const [pendingSignupEmail, setPendingSignupEmail] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordStrength = getPasswordStrength(password, email);

  async function finishLogin() {
    try {
      await markLoginDestinationAsOwned(nextPath);
    } catch (error) {
      console.error("Failed to record the selected mikke app", error);
    }
    window.location.replace(nextPath);
  }

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPendingSignupEmail("");
    setConfirmationCode("");
    setMessage("");
  }

  async function verifyConfirmationCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = confirmationCode.trim();
    if (!token) return;

    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.verifyOtp({
      email: pendingSignupEmail,
      token,
      type: "signup"
    });
    setLoading(false);
    if (error) {
      setMessage(getJapaneseAuthError(error.message));
      return;
    }
    if (data.user) {
      try {
        await saveEmailPreferences(data.user.id, {
          newsletter_enabled: emailUpdatesOptIn,
          product_updates_enabled: emailUpdatesOptIn
        }, "signup");
      } catch {
        // Registration remains complete. The preference can be set again from Settings.
      }
      try {
        await sendWelcomeEmail();
      } catch {
        // Registration remains complete even if the optional welcome email cannot be delivered.
      }
    }
    await finishLogin();
  }

  async function resendConfirmationCode() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingSignupEmail,
      options: { emailRedirectTo: `${window.location.origin}${nextPath}` }
    });
    setLoading(false);
    if (error) {
      setMessage(getJapaneseAuthError(error.message));
      return;
    }
    setResendCooldown(60);
    setMessage("確認メールをもう一度送りました。迷惑メールフォルダもご確認ください。");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setPendingSignupEmail(email);
          setResendCooldown(0);
        }
        setMessage(getJapaneseAuthError(error.message));
        return;
      }
      await finishLogin();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${nextPath}`
      }
    });
    setLoading(false);
    if (error) {
      setMessage(getJapaneseAuthError(error.message));
      return;
    }
    if (data.session && data.user) {
      try {
        await saveEmailPreferences(data.user.id, {
          newsletter_enabled: emailUpdatesOptIn,
          product_updates_enabled: emailUpdatesOptIn
        }, "signup");
      } catch {
        // Registration remains complete. The preference can be set again from Settings.
      }
      try {
        await sendWelcomeEmail();
      } catch {
        // Registration remains complete even if the optional welcome email cannot be delivered.
      }
      await finishLogin();
      return;
    }
    setPendingSignupEmail(email);
    setConfirmationCode("");
    setPassword("");
    setResendCooldown(60);
  }

  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)] px-4 py-8 text-[var(--mikke-text)] sm:px-5 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl gap-8 md:min-h-[calc(100vh-5rem)] md:grid-cols-[1fr_420px] md:items-center">
        <section className="self-end md:self-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mikke-accent)]">{destination.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-[var(--mikke-primary)] sm:text-4xl">{destination.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--mikke-muted)]">{destination.description}</p>
        </section>

        <section className="self-start rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 shadow-sm sm:p-6 md:self-auto">
          {pendingSignupEmail ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--mikke-accent)]">メールアドレスの確認</p>
              <h2 className="mt-2 text-xl font-bold text-[var(--mikke-primary)]">確認メールを送りました</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--mikke-muted)]">
                <span className="break-all font-bold text-[var(--mikke-text)]">{pendingSignupEmail}</span>
                <br />
                迷惑メールフォルダに入ることもあります。
              </p>
              <p className="mt-3 rounded-lg bg-[var(--mikke-surface-soft)] px-4 py-3 text-xs leading-5 text-[var(--mikke-muted)]">
                ご自分の端末の場合は、次回のログインに備えてパスワードを保存しておくと便利です。
              </p>

              <form onSubmit={verifyConfirmationCode} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-bold text-[var(--mikke-text)]">メールに届いた確認コードを入力してください</span>
                  <input
                    value={confirmationCode}
                    onChange={(event) => setConfirmationCode(event.target.value.replace(/\s/g, ""))}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-3 text-center text-xl font-bold tracking-[0.25em] outline-none focus:border-[var(--mikke-accent)]"
                  />
                </label>

                {message ? (
                  <p className="rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm leading-6 text-[var(--mikke-accent-strong)]" aria-live="polite">
                    {message}
                  </p>
                ) : null}

                <button type="submit" disabled={loading || !confirmationCode.trim()} className="w-full rounded-lg bg-[var(--mikke-primary)] px-4 py-3 font-bold text-white disabled:opacity-60">
                  {loading ? "確認中..." : "確認して続ける"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => void resendConfirmationCode()}
                disabled={loading || resendCooldown > 0}
                className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--mikke-primary)] disabled:text-[var(--mikke-muted-light)]"
              >
                {resendCooldown > 0 ? `もう一度送る（あと${resendCooldown}秒）` : "確認メールをもう一度送る"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingSignupEmail("");
                  setConfirmationCode("");
                  setMessage("");
                }}
                className="mt-3 w-full px-4 py-2 text-sm font-bold text-[var(--mikke-muted)]"
              >
                メールアドレスを直す
              </button>
              <p className="mt-4 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">by mikke</p>
            </div>
          ) : (
            <>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-1" aria-label="ログイン方法">
            <button
              type="button"
              onClick={() => selectMode("login")}
              aria-pressed={mode === "login"}
              className={`rounded-md px-3 py-2.5 text-sm font-bold transition-colors ${
                mode === "login"
                  ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)] shadow-sm"
                  : "text-[var(--mikke-muted)]"
              }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => selectMode("signup")}
              aria-pressed={mode === "signup"}
              className={`rounded-md px-3 py-2.5 text-sm font-bold transition-colors ${
                mode === "signup"
                  ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)] shadow-sm"
                  : "text-[var(--mikke-muted)]"
              }`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-[var(--mikke-text)]">メールアドレス</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                required
                className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-3 outline-none focus:border-[var(--mikke-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-[var(--mikke-text)]">パスワード</span>
              <span className="relative mt-2 block">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  aria-describedby={mode === "signup" ? "password-help" : undefined}
                  className="w-full rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-3 pr-12 outline-none focus:border-[var(--mikke-accent)]"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示する"} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--mikke-muted)]">
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
              {mode === "signup" ? (
                <span id="password-help" className="mt-2 block">
                  {password ? (
                    <span
                      role="meter"
                      aria-label="パスワードの安心度"
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-valuenow={passwordStrength.level}
                      aria-valuetext={passwordStrength.label}
                      className="block"
                    >
                      <span className="grid grid-cols-3 gap-1" aria-hidden="true">
                        {passwordStrengthBarClasses.map((barClass, index) => (
                          <span key={barClass} className={`h-1.5 rounded-full ${index <= passwordStrength.level ? barClass : "bg-[var(--mikke-surface-soft)]"}`} />
                        ))}
                      </span>
                      <span className="mt-2 block text-xs">
                        <span className="block font-bold text-[var(--mikke-primary)]">安心度：{passwordStrength.label}</span>
                        <span className="mt-1 block leading-5 text-[var(--mikke-muted)]">{passwordStrength.guidance}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs leading-5 text-[var(--mikke-muted)]">
                      8文字以上で入力してください。名前や誕生日だけの組み合わせは避けましょう。
                    </span>
                  )}
                </span>
              ) : null}
            </label>

            {mode === "login" ? (
              <div className="text-right">
                <Link href="/reset-password" className="text-sm font-bold text-[var(--mikke-primary)] underline underline-offset-4">
                  パスワードを忘れた方
                </Link>
              </div>
            ) : null}

            {mode === "signup" ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
                <input type="checkbox" checked={emailUpdatesOptIn} onChange={(event) => setEmailUpdatesOptIn(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--mikke-primary)]" />
                <span>
                  <span className="block text-sm font-bold text-[var(--mikke-text)]">mikkeOSのお知らせをメールで受け取る（任意）</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">使い方、新機能、イベントなどをご案内します。あとから設定で変更できます。</span>
                </span>
              </label>
            ) : null}

            {message ? (
              <p className="rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm leading-6 text-[var(--mikke-accent-strong)]" aria-live="polite">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--mikke-primary)] px-4 py-3 font-bold text-white disabled:opacity-60"
            >
              {loading ? "確認中..." : mode === "login" ? "ログイン" : "新規登録"}
            </button>
          </form>

          {showMarketNoteGuestEntry ? (
            <>
              <div className="my-5 flex items-center gap-3 text-xs font-semibold text-[var(--mikke-muted-light)]" aria-hidden="true">
                <span className="h-px flex-1 bg-[var(--mikke-line)]" />
                または
                <span className="h-px flex-1 bg-[var(--mikke-line)]" />
              </div>

              <button
                type="button"
                onClick={() => router.push("/marketnote")}
                className="w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-muted)]"
              >
                ログインせずにMarketNoteへ
              </button>
            </>
          ) : null}

          <p className="mt-5 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">by mikke</p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
