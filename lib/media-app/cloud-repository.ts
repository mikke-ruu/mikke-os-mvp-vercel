import type { SupabaseClient } from "@supabase/supabase-js";
import { createMediaDatabaseOperations, type MediaPublicationAttestation, type MediaArticleDraftDatabaseRow } from "./database-operations";
import type { MediaArticle, MediaArticleSnapshot, MediaSite } from "./types";
import type { SaveMediaArticleInput } from "./store";

type Category = { id: string; name: string; sort_order: number };
type ArticleRow = MediaArticleDraftDatabaseRow & { status: MediaArticle["status"]; current_published_version_id: string | null };
type Version = { title: string; slug: string; excerpt: string; category_name: string; cover_image_url: string; blocks: MediaArticleSnapshot["blocks"]; published_at: string };
type Scope = { subject: string; check: () => Promise<void>; step: <T>(action: () => PromiseLike<T>) => Promise<T> };
const articleColumns = "id,site_id,title,slug,excerpt,locale,draft_blocks,category_id,cover_image_url,cover_image_asset_id,created_at,updated_at,status,current_published_version_id";
const randomSlug = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);

/** Authenticated UI repository. Never imports browser drafts or uses profile IDs as authority. */
export function createMediaCloudRepository(client: SupabaseClient, expectedSubject: string) {
  const db = createMediaDatabaseOperations(client);

  async function run<T>(action: (scope: Scope) => Promise<T>): Promise<T> {
    let changed = false;
    const { data: subscription } = client.auth.onAuthStateChange((event) => {
      if (event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED") changed = true;
    });
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user || data.user.is_anonymous) throw new Error("ログインし直してください。");
      // UI identity is only a stale-screen precondition. RLS/getUser remain the
      // authority; a caller cannot select another owner by supplying this value.
      if (!expectedSubject || data.user.id !== expectedSubject) throw new Error("ログイン状態が変わりました。画面を開き直してください。");
      const subject = data.user.id;
      const check = async () => {
        const latest = await client.auth.getUser();
        if (changed || latest.error || !latest.data.user || latest.data.user.is_anonymous || latest.data.user.id !== subject) {
          throw new Error("ログイン状態が変わりました。画面を開き直してください。");
        }
      };
      const scope: Scope = { subject, check, step: async (operation) => { await check(); const value = await operation(); await check(); return value; } };
      const value = await action(scope);
      await check();
      return value;
    } finally { subscription.subscription.unsubscribe(); }
  }

  async function categories(scope: Scope, siteId: string) {
    const { data, error } = await scope.step(() => client.from("media_categories").select("id,name,sort_order").eq("site_id", siteId).order("sort_order").returns<Category[]>());
    if (error) throw error;
    return data ?? [];
  }

  async function site(scope: Scope, id?: string): Promise<MediaSite | null> {
    const sites = await scope.step(() => db.listMyMediaSitesFromDatabase());
    const row = id ? sites.find((value) => value.id === id) : sites[0];
    if (!row) return null;
    return { id: row.id, ownerProfileId: scope.subject, name: row.name, slug: row.slug, description: row.description,
      authorName: row.author_name, categories: (await categories(scope, row.id)).map((category) => category.name),
      createdAt: row.created_at, updatedAt: row.updated_at };
  }
  async function requireSite(scope: Scope, id: string) {
    const value = await site(scope, id);
    if (!value) throw new Error("Mediaが見つかりませんでした。");
    return value;
  }

  async function article(scope: Scope, id: string): Promise<MediaArticle | null> {
    const { data: row, error } = await scope.step(() => client.from("media_articles").select(articleColumns).eq("id", id).maybeSingle<ArticleRow>());
    if (error) throw error;
    if (!row || !await site(scope, row.site_id)) return null;
    const names = await categories(scope, row.site_id);
    let publishedSnapshot: MediaArticleSnapshot | null = null;
    if (row.status === "published" && row.current_published_version_id) {
      const result = await scope.step(() => client.from("media_article_versions")
        .select("title,slug,excerpt,category_name,cover_image_url,blocks,published_at")
        .eq("id", row.current_published_version_id).eq("article_id", id).eq("site_id", row.site_id).maybeSingle<Version>());
      if (result.error) throw result.error;
      if (!result.data) throw new Error("公開版を読み込めませんでした。");
      const version = result.data;
      publishedSnapshot = { title: version.title, slug: version.slug, excerpt: version.excerpt, category: version.category_name,
        coverImageUrl: version.cover_image_url, blocks: version.blocks, publishedAt: version.published_at, updatedAt: version.published_at };
    }
    return { id: row.id, mediaId: row.site_id, title: row.title, slug: row.slug, excerpt: row.excerpt,
      category: names.find((value) => value.id === row.category_id)?.name ?? "", coverImageUrl: row.cover_image_url ?? "",
      coverImageAssetId: row.cover_image_asset_id ?? undefined, blocks: row.draft_blocks, status: row.status,
      publishedSnapshot, createdAt: row.created_at, updatedAt: row.updated_at };
  }
  async function requireArticle(scope: Scope, id: string) {
    const value = await article(scope, id);
    if (!value) throw new Error("記事が見つかりませんでした。");
    return value;
  }

  function rejectProfileFields(input: object) {
    if ("authorBio" in input || "storyUrl" in input || "showStory" in input) {
      throw new Error("自己紹介とSTORY連携のクラウド保存は準備中です。");
    }
  }
  async function insertCategory(scope: Scope, siteId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed || Array.from(trimmed).length > 60) throw new Error("カテゴリー名は1〜60文字で入力してください。");
    const existing = await categories(scope, siteId);
    if (existing.some((value) => value.name === trimmed)) return;
    if (existing.length >= 100) throw new Error("カテゴリーは100件まで追加できます。");
    const { error } = await scope.step(() => client.from("media_categories").insert({ site_id: siteId, name: trimmed, slug: randomSlug(), sort_order: existing.length }));
    if (error) throw error;
  }

  return {
    getOwnedMedia: (_profileId?: string) => run((scope) => site(scope)),
    getMediaSite: (id: string) => run((scope) => site(scope, id)),
    getMediaArticle: (id: string) => run((scope) => article(scope, id)),
    listMediaArticles: (siteId: string) => run(async (scope) => {
      await requireSite(scope, siteId);
      const { data, error } = await scope.step(() => client.from("media_articles").select("id").eq("site_id", siteId).order("updated_at", { ascending: false }).returns<{ id: string }[]>());
      if (error) throw error;
      const values: MediaArticle[] = [];
      for (const row of data ?? []) { const value = await article(scope, row.id); if (value) values.push(value); }
      return values;
    }),
    createMediaSite: (input: Pick<MediaSite, "ownerProfileId" | "name" | "slug" | "description" | "authorName">) => run(async (scope) => {
      rejectProfileFields(input);
      const id = await scope.step(() => db.createMediaSiteInDatabase({ name: input.name.trim(), slug: input.slug.trim().toLowerCase(), description: input.description.trim(), authorName: input.authorName.trim() || input.name.trim() }));
      return requireSite(scope, id);
    }),
    updateMediaSite: (id: string, input: Pick<MediaSite, "name" | "slug" | "description" | "authorName" | "categories">) => run(async (scope) => {
      rejectProfileFields(input);
      const current = await requireSite(scope, id);
      const wanted = [...new Set(input.categories.map((name) => name.trim()).filter(Boolean))];
      if (current.categories.some((name) => !wanted.includes(name))) throw new Error("カテゴリーの削除と名前変更は準備中です。追加のみ利用できます。");
      if (wanted.length > 100 || wanted.some((name) => Array.from(name).length > 60)) throw new Error("カテゴリーは100件まで、名前は60文字以内で入力してください。");
      // Refuse multi-table updates rather than report a partially saved settings form.
      if (wanted.some((name) => !current.categories.includes(name))) throw new Error("カテゴリーは記事編集画面の追加ボタンから追加してください。");
      const { data, error } = await scope.step(() => client.from("media_sites").update({ name: input.name.trim(), slug: input.slug.trim().toLowerCase(), description: input.description.trim(), author_name: input.authorName.trim() || input.name.trim() }).eq("id", id).select("id").single());
      if (error) throw error;
      if (!data) throw new Error("設定を保存できませんでした。");
      return requireSite(scope, id);
    }),
    updateMediaAuthorProfile: async (_id: string, _input: { authorBio: string; storyUrl: string; showStory: boolean }): Promise<MediaSite> => {
      throw new Error("自己紹介とSTORY連携のクラウド保存は準備中です。");
    },
    addMediaCategory: (id: string, name: string) => run(async (scope) => { await requireSite(scope, id); await insertCategory(scope, id, name); return requireSite(scope, id); }),
    saveMediaArticle: (siteId: string, id: string | null, input: SaveMediaArticleInput) => run(async (scope) => {
      await requireSite(scope, siteId);
      const current = id ? await requireArticle(scope, id) : null;
      if (current && current.mediaId !== siteId) throw new Error("この記事はこのMediaにありません。");
      const names = await categories(scope, siteId);
      const category = input.category ? names.find((value) => value.name === input.category) : null;
      if (input.category && !category) throw new Error("カテゴリーを選び直してください。");
      const slug = input.slug.trim().toLowerCase() || current?.slug || randomSlug();
      if (slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("記事URL名は80文字以内の半角英数字とハイフンで入力してください。");
      const values = { title: input.title.trim(), slug, excerpt: input.excerpt.trim(), blocks: input.blocks,
        categoryId: category?.id ?? null, coverImageUrl: input.coverImageUrl, coverImageAssetId: input.coverImageAssetId || null };
      const saved = await scope.step(() => id ? db.updateMediaArticleDraftInDatabase(id, values) : db.createMediaArticleDraftInDatabase(siteId, values));
      return requireArticle(scope, saved.id);
    }),
    publishMediaArticle: (id: string, attestation?: MediaPublicationAttestation) => run(async (scope) => {
      if (!attestation?.termsVersion.trim() || attestation.rightsConfirmed !== true || attestation.privacyConfirmed !== true || attestation.affiliateFreeConfirmed !== true) throw new Error("利用条件と公開前の確認が必要です。");
      await requireArticle(scope, id);
      await scope.step(() => db.publishMediaArticleInDatabase(id, attestation));
      return requireArticle(scope, id);
    }),
    unpublishMediaArticle: (id: string) => run(async (scope) => { await requireArticle(scope, id); await scope.step(() => db.unpublishMediaArticleInDatabase(id)); return requireArticle(scope, id); })
  };
}
