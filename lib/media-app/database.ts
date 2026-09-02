import { supabase } from "@/lib/supabase/client";

export type MediaSiteDatabaseRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  author_name: string;
  default_locale: string;
  publishing_policy: "direct_owner" | "managed_brand";
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

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

// The local prototype is deliberately not read here. A cloud Media becomes
// owned only when media_create_site commits both the site and entitlement.
export async function createMediaSiteInDatabase(input: CreateMediaSiteInput) {
  const { data, error } = await supabase.rpc("media_create_site", {
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

export async function listMyMediaSitesFromDatabase() {
  const { data, error } = await supabase
    .from("media_sites")
    .select("id,name,slug,description,author_name,default_locale,publishing_policy,is_published,created_at,updated_at")
    .eq("publishing_policy", "direct_owner")
    .order("created_at", { ascending: true })
    .returns<MediaSiteDatabaseRow[]>();
  if (error) throw error;
  return data ?? [];
}

export async function publishMediaArticleInDatabase(
  articleId: string,
  attestation: MediaPublicationAttestation
) {
  const { data, error } = await supabase.rpc("media_publish_article", {
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

export async function unpublishMediaArticleInDatabase(articleId: string) {
  const { error } = await supabase.rpc("media_unpublish_article", { p_article_id: articleId });
  if (error) throw error;
}
