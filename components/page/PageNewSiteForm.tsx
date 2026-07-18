"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { createPageSite, normalizePageSiteSlug } from "@/lib/page/store";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

export function PageNewSiteForm() {
  const router = useRouter();
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedSlug = normalizePageSiteSlug(slug);
    if (!name.trim() || !normalizedSlug) {
      setMessage("サイト名と下書きslugを入力してください。");
      return;
    }

    setSaving(true);
    try {
      createPageSite({
        ownerProfileId: profile.id,
        name,
        description,
        slug: normalizedSlug
      });
      router.push("/apps/page");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pageを作成できませんでした。");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl">
      <section className="rounded-3xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-accent)]">PG-1-b</p>
            <h2 className="mt-1 text-xl font-bold tracking-normal">サイトの基本情報</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">
              まずは下書きサイトと空のホームページを作ります。外部への公開は行いません。
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5">
          <label className="block">
            <span className="text-xs font-bold text-[var(--mikke-text)]">
              サイト名<span className="ml-1 text-[var(--mikke-accent)]">*</span>
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="例: むすび商店"
              maxLength={80}
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[var(--mikke-text)]">説明</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${inputClass} resize-y`}
              placeholder="活動内容や、このサイトで伝えたいこと"
              rows={4}
              maxLength={300}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[var(--mikke-text)]">
              下書きslug<span className="ml-1 text-[var(--mikke-accent)]">*</span>
            </span>
            <div className="mt-1.5 flex items-center rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] focus-within:border-[var(--mikke-accent)]">
              <span className="pl-3 text-sm font-bold text-[var(--mikke-muted)]">/</span>
              <input
                value={slug}
                onChange={(event) =>
                  setSlug(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                      .replace(/-{2,}/g, "-")
                      .replace(/^-/, "")
                  )
                }
                onBlur={() => setSlug((current) => normalizePageSiteSlug(current))}
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm outline-none"
                placeholder="musubi-shop"
                inputMode="url"
                maxLength={80}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </div>
            <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">
              半角英小文字・数字・ハイフンを使います。公開URLはPG-3以降で決めます。
            </span>
          </label>
        </div>

        {message ? (
          <p role="alert" className="mt-5 rounded-xl bg-[var(--mikke-primary-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-text)]">
            {message}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mikke-line-soft)] pt-5">
          <Link href="/apps/page" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[var(--mikke-muted)]">
            <ArrowLeft size={16} /> 一覧へ戻る
          </Link>
          <button
            type="submit"
            disabled={saving || !name.trim() || !slug}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} /> {saving ? "作成中..." : "下書きPageを作る"}
          </button>
        </div>
      </section>

      <p className="mt-4 text-center text-xs leading-5 text-[var(--mikke-muted)]">
        他者掲載依頼、Manager受信箱、決済、独自ドメインはこの画面では扱いません。
      </p>
    </form>
  );
}
