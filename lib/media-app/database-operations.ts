import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaBlock } from "./types";
import type {
  MediaCreateInput,
  MediaDirectOwnerSite,
  MediaManagementTransport,
  MediaSession
} from "./integration";

export type MediaSiteDatabaseRow = MediaDirectOwnerSite;

export type CreateMediaSiteInput = {
  name: string;
  slug: string;
  description: string;
  authorName: string;
  defaultLocale?: string;
};

export type MediaPublicationAttestation = {
  termsVersion: string;
  rightsConfirmed: true;
  privacyConfirmed: true;
  affiliateFreeConfirmed: true;
};

export type MediaArticleDraftInput = {
  title: string;
  slug: string;
  excerpt?: string;
  locale?: string;
  blocks: MediaBlock[];
};

export type MediaArticleDraftDatabaseRow = {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  excerpt: string;
  locale: string;
  draft_blocks: MediaBlock[];
  created_at: string;
  updated_at: string;
};

const draftColumns = "id,site_id,title,slug,excerpt,locale,draft_blocks,created_at,updated_at";

// Callers inject their authenticated client; RLS remains the ownership authority.
export function createMediaDatabaseOperations(client: SupabaseClient) {
  // The local prototype is deliberately not read here. A cloud Media becomes
  // owned only when media_create_site commits both the site and entitlement.
  async function createMediaSiteInDatabase(input: CreateMediaSiteInput) {
    const { data, error } = await client.rpc("media_create_site", {
      p_name: input.name,
      p_slug: input.slug,
      p_description: input.description,
      p_author_name: input.authorName,
      p_default_locale: input.defaultLocale ?? "ja-JP"
    });
    if (error) throw error;
    if (typeof data !== "string") throw new Error("MEDIA_CREATE_RESULT_INVALID");
    return data;
  }

  async function listMyMediaSitesFromDatabase() {
    const { data, error } = await client
      .from("media_sites")
      .select("id,name,slug,description,author_name,default_locale,publishing_policy,is_published,created_at,updated_at")
      .eq("publishing_policy", "direct_owner")
      .order("created_at", { ascending: true })
      .returns<MediaSiteDatabaseRow[]>();
    if (error) throw error;
    return data ?? [];
  }

  async function publishMediaArticleInDatabase(
    articleId: string,
    attestation: MediaPublicationAttestation
  ) {
    const { data, error } = await client.rpc("media_publish_article", {
      p_article_id: articleId,
      p_terms_version: attestation.termsVersion,
      p_rights_confirmed: attestation.rightsConfirmed,
      p_privacy_confirmed: attestation.privacyConfirmed,
      p_affiliate_free_confirmed: attestation.affiliateFreeConfirmed
    });
    if (error) throw error;
    if (typeof data !== "string") throw new Error("MEDIA_PUBLISH_RESULT_INVALID");
    return data;
  }

  async function unpublishMediaArticleInDatabase(articleId: string) {
    const { error } = await client.rpc("media_unpublish_article", { p_article_id: articleId });
    if (error) throw error;
  }

  async function readDatabaseSession(): Promise<MediaSession | null> {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return {
      subject: data.user.id,
      isAnonymous: Boolean(data.user.is_anonymous)
    };
  }

  const mediaDatabaseTransport: MediaManagementTransport = {
    readSession: readDatabaseSession,
    subscribeSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange(() => listener());
      return () => data.subscription.unsubscribe();
    },
    listDirectOwnerSites: listMyMediaSitesFromDatabase,
    createDirectOwnerSite: (input: MediaCreateInput) => createMediaSiteInDatabase(input)
  };
  // Explicit projection prevents input objects from writing publication state.
  function draftValues(input: MediaArticleDraftInput) {
    return {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? "",
      locale: input.locale ?? "ja-JP",
      draft_blocks: input.blocks
    };
  }

  async function createMediaArticleDraftInDatabase(siteId: string, input: MediaArticleDraftInput) {
    const { data, error } = await client.from("media_articles")
      .insert({ site_id: siteId, ...draftValues(input) })
      .select(draftColumns).single<MediaArticleDraftDatabaseRow>();
    if (error) throw error;
    if (!data) throw new Error("MEDIA_DRAFT_CREATE_RESULT_INVALID");
    return data;
  }

  async function readMediaArticleDraftFromDatabase(articleId: string) {
    const { data, error } = await client.from("media_articles")
      .select(draftColumns).eq("id", articleId).maybeSingle<MediaArticleDraftDatabaseRow>();
    if (error) throw error;
    return data;
  }

  async function updateMediaArticleDraftInDatabase(articleId: string, input: MediaArticleDraftInput) {
    const { data, error } = await client.from("media_articles")
      .update(draftValues(input)).eq("id", articleId)
      .select(draftColumns).single<MediaArticleDraftDatabaseRow>();
    if (error) throw error;
    if (!data) throw new Error("MEDIA_DRAFT_UPDATE_RESULT_INVALID");
    return data;
  }

  return {
    createMediaSiteInDatabase,
    listMyMediaSitesFromDatabase,
    publishMediaArticleInDatabase,
    unpublishMediaArticleInDatabase,
    createMediaArticleDraftInDatabase,
    readMediaArticleDraftFromDatabase,
    updateMediaArticleDraftInDatabase,
    mediaDatabaseTransport
  };
}
