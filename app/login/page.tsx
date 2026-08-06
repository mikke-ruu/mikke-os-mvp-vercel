"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

function safeNextPath(value: string | null) {
  if (!value) return "/os";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/os";
}

function getNextPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const nextPath = getNextPath();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      router.replace(nextPath);
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
      setMessage(error.message);
      return;
    }
    if (data.session) {
      router.replace(nextPath);
      return;
    }
    setMessage("確認メールを送りました。メール内のリンクからmikkeに戻ってください。");
  }

  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)] px-4 py-8 text-[var(--mikke-text)] sm:px-5 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl gap-8 md:min-h-[calc(100vh-5rem)] md:grid-cols-[1fr_420px] md:items-center">
        <section className="self-end md:self-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mikke-accent)]">MIKKE ID</p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-[var(--mikke-primary)] sm:text-4xl">mikkeへようこそ</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--mikke-muted)]">
            mikke IDでログインすると、利用中のアプリや活動の記録をひとつのアカウントで続けられます。はじめての方は、無料登録を選んでください。
          </p>
        </section>

        <section className="self-start rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5 shadow-sm sm:p-6 md:self-auto">
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
              無料登録
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
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-3 outline-none focus:border-[var(--mikke-accent)]"
              />
            </label>

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
              {loading ? "確認中..." : mode === "login" ? "ログイン" : "無料で登録"}
            </button>
          </form>

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

          <p className="mt-5 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">by mikke</p>
        </section>
      </div>
    </main>
  );
}
