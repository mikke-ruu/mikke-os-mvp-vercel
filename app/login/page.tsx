"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (!value) return "/os";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/os";
}

function getNextPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

function getGuestReturnPath() {
  const nextPath = getNextPath();
  return nextPath === "/os" ? "/marketnote" : nextPath;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.replace(getNextPath());
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage("");
    const nextPath = getNextPath();
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
    setMessage("登録しました。確認メールが届いた場合は、メール内のリンクを開いてください。");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--mikke-surface-soft)] px-5">
      <div className="w-full max-w-md rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-[var(--mikke-text)]">ログイン</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
          MarketNoteの記録をクラウドに保存したり、別の端末でも続きを見るための入口です。ログインなしで使う場合は、MarketNoteへ戻ってそのまま始められます。
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-[var(--mikke-text)]">メールアドレス</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 outline-none focus:border-[var(--mikke-accent)]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[var(--mikke-text)]">パスワード</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              minLength={6}
              className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 outline-none focus:border-[var(--mikke-accent)]"
            />
          </label>

          {message ? (
            <p className="rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm leading-6 text-[var(--mikke-accent-strong)]">{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--mikke-primary)] px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {loading ? "確認中..." : "ログイン"}
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading || !email || password.length < 6}
            className="w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-4 py-3 font-bold text-[var(--mikke-text)] disabled:opacity-50"
          >
            新規登録
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push(getGuestReturnPath())}
          className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-muted)]"
        >
          ログインせずMarketNoteへ戻る
        </button>

        <p className="mt-6 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">by mikke</p>
      </div>
    </main>
  );
}
