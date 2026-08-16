import { supabase } from "@/lib/supabase/client";

export type JournalArticleStatus = "draft" | "published" | "archived";
export type JournalBlockType = "paragraph" | "heading" | "image" | "quote" | "list" | "divider" | "link-card" | "cta";

export type JournalBlock = {
  id: string;
  type: JournalBlockType;
  text?: string;
  level?: 2 | 3;
  imageUrl?: string;
  imageAssetId?: string;
  alt?: string;
  caption?: string;
  attribution?: string;
  items?: string[];
  title?: string;
  description?: string;
  url?: string;
  label?: string;
};

export type JournalCategory = {
  id: string;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type JournalArticle = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string;
  cover_image_asset_id: string | null;
  blocks: JournalBlock[];
  is_featured: boolean;
  cta_label: string;
  cta_url: string;
  status: JournalArticleStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category?: JournalCategory | null;
};

export type JournalArticleInput = Pick<
  JournalArticle,
  "category_id" | "slug" | "title" | "excerpt" | "cover_image_url" | "cover_image_asset_id" | "blocks" | "is_featured" | "cta_label" | "cta_url" | "status"
>;

const articleSelect = "*, category:mikkeos_hq_article_categories(id,name,slug,color,sort_order,is_active,created_at,updated_at)";

function categoryFromRelation(value: unknown): JournalCategory | null {
  if (Array.isArray(value)) return (value[0] as JournalCategory | undefined) ?? null;
  return (value as JournalCategory | null) ?? null;
}

function normalizeArticle(row: Record<string, unknown>): JournalArticle {
  return {
    ...(row as unknown as JournalArticle),
    category: categoryFromRelation(row.category),
    blocks: Array.isArray(row.blocks) ? row.blocks as JournalBlock[] : []
  };
}

function normalizePublicArticle(row: Record<string, unknown>): JournalArticle {
  const categoryId = typeof row.category_id === "string" ? row.category_id : null;
  const categoryName = typeof row.category_name === "string" ? row.category_name : "";
  return {
    id: String(row.id),
    category_id: categoryId,
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    excerpt: String(row.excerpt ?? ""),
    cover_image_url: String(row.cover_image_url ?? ""),
    cover_image_asset_id: null,
    blocks: Array.isArray(row.blocks) ? row.blocks as JournalBlock[] : [],
    is_featured: Boolean(row.is_featured),
    cta_label: String(row.cta_label ?? ""),
    cta_url: String(row.cta_url ?? ""),
    status: "published",
    published_at: typeof row.published_at === "string" ? row.published_at : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    category: categoryId && categoryName ? {
      id: categoryId,
      name: categoryName,
      slug: String(row.category_slug ?? ""),
      color: String(row.category_color ?? "#3f4eb5"),
      sort_order: 0,
      is_active: true,
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? ""),
    } : null,
  };
}

function throwJournalError(error: { code?: string; message?: string }): never {
  const unavailable = ["PGRST202", "PGRST205"].includes(error.code ?? "")
    || /could not find (the function|the table)|schema cache/i.test(error.message ?? "");
  if (unavailable) {
    throw new Error("記事機能を準備しています。DB設定が完了すると、ここに記事が表示されます。");
  }
  throw new Error(error.message || "記事機能を利用できませんでした。");
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("本部アカウントでログインしてください。");
  return data.user.id;
}

export function normalizeJournalSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function isSafeJournalUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function createJournalBlock(type: JournalBlockType): JournalBlock {
  const id = `journal_block_${crypto.randomUUID()}`;
  switch (type) {
    case "heading": return { id, type, level: 2, text: "" };
    case "image": return { id, type, imageUrl: "", alt: "", caption: "" };
    case "quote": return { id, type, text: "", attribution: "" };
    case "list": return { id, type, items: [""] };
    case "divider": return { id, type };
    case "link-card": return { id, type, title: "", description: "", url: "" };
    case "cta": return { id, type, label: "詳しく見る", url: "" };
    default: return { id, type: "paragraph", text: "" };
  }
}

export async function listJournalCategories(): Promise<JournalCategory[]> {
  const { data, error } = await supabase
    .from("mikkeos_hq_article_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throwJournalError(error);
  return (data ?? []) as JournalCategory[];
}

export async function createJournalCategory(input: Pick<JournalCategory, "name" | "slug" | "color">): Promise<JournalCategory> {
  const categories = await listJournalCategories();
  const { data, error } = await supabase
    .from("mikkeos_hq_article_categories")
    .insert({ ...input, sort_order: categories.length })
    .select("*")
    .single();
  if (error) throwJournalError(error);
  return data as JournalCategory;
}

export async function updateJournalCategory(id: string, patch: Partial<Pick<JournalCategory, "name" | "slug" | "color" | "sort_order" | "is_active">>): Promise<void> {
  const { error } = await supabase.from("mikkeos_hq_article_categories").update(patch).eq("id", id);
  if (error) throwJournalError(error);
}

export async function listHqJournalArticles(): Promise<JournalArticle[]> {
  const { data, error } = await supabase
    .from("mikkeos_hq_articles")
    .select(articleSelect)
    .order("updated_at", { ascending: false });
  if (error) throwJournalError(error);
  return (data ?? []).map((row) => normalizeArticle(row as Record<string, unknown>));
}

export async function getHqJournalArticle(id: string): Promise<JournalArticle | null> {
  const { data, error } = await supabase
    .from("mikkeos_hq_articles")
    .select(articleSelect)
    .eq("id", id)
    .maybeSingle();
  if (error) throwJournalError(error);
  return data ? normalizeArticle(data as Record<string, unknown>) : null;
}

export async function listPublishedJournalArticles(limit?: number): Promise<JournalArticle[]> {
  const { data, error } = await supabase.rpc("mikkeos_public_journal_articles", { p_limit: limit ?? 50 });
  if (error) throwJournalError(error);
  return (data ?? []).map((row: Record<string, unknown>) => normalizePublicArticle(row));
}

export async function getPublishedJournalArticle(slug: string): Promise<JournalArticle | null> {
  const { data, error } = await supabase.rpc("mikkeos_public_journal_article", { p_slug: normalizeJournalSlug(slug) });
  if (error) throwJournalError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return row ? normalizePublicArticle(row as Record<string, unknown>) : null;
}

export async function createJournalArticle(input: JournalArticleInput): Promise<JournalArticle> {
  const userId = await currentUserId();
  const publishedAt = input.status === "published" ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("mikkeos_hq_articles")
    .insert({ ...input, created_by: userId, updated_by: userId, published_at: publishedAt })
    .select(articleSelect)
    .single();
  if (error) throwJournalError(error);
  return normalizeArticle(data as Record<string, unknown>);
}

export async function updateJournalArticle(id: string, input: JournalArticleInput, previousPublishedAt: string | null): Promise<JournalArticle> {
  const userId = await currentUserId();
  const publishedAt = input.status === "published" ? previousPublishedAt ?? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("mikkeos_hq_articles")
    .update({ ...input, updated_by: userId, published_at: publishedAt })
    .eq("id", id)
    .select(articleSelect)
    .single();
  if (error) throwJournalError(error);
  return normalizeArticle(data as Record<string, unknown>);
}
