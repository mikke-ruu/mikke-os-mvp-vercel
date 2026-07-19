"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { createPageSite, normalizePageSiteSlug } from "@/lib/page/store";
import type { PageFontPreset } from "@/lib/page/types";
import type { PageStarterTemplateId } from "@/lib/page/templates";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

export function PageNewSiteForm() {
  const router = useRouter();
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [templateId, setTemplateId] = useState<PageStarterTemplateId>("company");
  const [themePreset, setThemePreset] = useState<PageFontPreset>("gothic");
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
        slug: normalizedSlug,
        templateId,
        themePreset
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
            <h2 className="mt-1 text-xl font-bold tracking-normal">サイトの基本情報</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">
              テンプレートと雰囲気を選ぶと、編集できるホームページの下書きが作られます。外部への公開は行いません。
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

          <fieldset>
            <legend className="text-xs font-bold text-[var(--mikke-text)]">最初のページ</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([
                ["company", "会社・団体", "紹介、会社概要、問い合わせ導線"],
                ["service", "サービス", "特徴、CMS、お問い合わせ"],
                ["portfolio", "作品・実績", "ギャラリーと活動CMS"],
                ["connect-partners", "Connect / Partners", "複数アプリCMSの構築例"],
                ["blank", "白紙", "自分で一から組み立てる"]
              ] as const).map(([value, label, helper]) => (
                <label key={value} className={`cursor-pointer rounded-xl border p-3 ${templateId === value ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] bg-white"}`}>
                  <input type="radio" name="template" value={value} checked={templateId === value} onChange={() => setTemplateId(value)} className="sr-only" />
                  <span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs text-[var(--mikke-muted)]">{helper}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-bold text-[var(--mikke-text)]">デザインの雰囲気</span>
            <select value={themePreset} onChange={(event) => setThemePreset(event.target.value as PageFontPreset)} className={inputClass}>
              <option value="gothic">すっきり</option><option value="soft">やわらかい</option><option value="serif">上品</option><option value="modern">モダン</option>
            </select>
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
              半角英小文字・数字・ハイフンを使います。公開URLは公開機能の実装時に決めます。
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
