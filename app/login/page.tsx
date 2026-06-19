"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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

    router.replace("/home");
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    setMessage(error ? error.message : "登録しました。確認メールが届いた場合は、メール内のリンクを開いてください。");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-5">
      <div className="w-full max-w-md rounded-3xl border border-[#e8e1da] bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#d9643a]">Mikke OS</p>
        <h1 className="mt-2 text-3xl font-bold text-[#25211f]">ログイン</h1>
        <p className="mt-2 text-sm leading-6 text-[#79716b]">
          MarketNoteから活動を記録して、StoryとDESKに反映します。
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-[#25211f]">メールアドレス</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="mt-2 w-full rounded-2xl border border-[#e8e1da] bg-[#fbfaf8] px-4 py-3 outline-none focus:border-[#d9643a]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[#25211f]">パスワード</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              minLength={6}
              className="mt-2 w-full rounded-2xl border border-[#e8e1da] bg-[#fbfaf8] px-4 py-3 outline-none focus:border-[#d9643a]"
            />
          </label>

          {message ? (
            <p className="rounded-2xl bg-[#fff0e9] px-4 py-3 text-sm leading-6 text-[#8f3d22]">{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[#d9643a] px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {loading ? "確認中..." : "ログイン"}
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading || !email || password.length < 6}
            className="w-full rounded-2xl border border-[#e8e1da] bg-white px-4 py-3 font-bold text-[#25211f] disabled:opacity-50"
          >
            新規登録
          </button>
        </form>
      </div>
    </main>
  );
}
