"use client";
import { useAuth } from "@/components/AuthGate";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import * as local from "@/lib/media-app/store";
import type { MediaPublicationAttestation } from "@/lib/media-app/database-operations";
import type { MediaActiveTerms } from "@/lib/media-app/cloud-repository";
const names = ["getOwnedMedia","getMediaSite","getMediaArticle","listMediaArticles","createMediaSite","updateMediaSite","addMediaCategory","saveMediaArticle","unpublishMediaArticle","updateMediaAuthorProfile"] as const;
type Methods = { [K in typeof names[number]]: (...args: Parameters<typeof local[K]>) => Promise<ReturnType<typeof local[K]>> };
type Repository = Methods & {
  cloud:boolean;
  currentTerms():Promise<MediaActiveTerms|null>;
  acceptTerms(terms:MediaActiveTerms):Promise<void>;
  publishMediaArticle(id:string,attestation?:MediaPublicationAttestation):Promise<ReturnType<typeof local.publishMediaArticle>>;
};
const remotes = new Map<string, Promise<ReturnType<typeof import("@/lib/media-app/cloud-repository").createMediaCloudRepository>>>();
function getRemote(expectedSubject: string) {
  const existing=remotes.get(expectedSubject);if(existing)return existing;
  const result= Promise.all([import("@/lib/media-app/cloud-repository"),import("@/lib/supabase/client")]).then(([module,{supabase}])=>module.createMediaCloudRepository(supabase,expectedSubject));
  remotes.set(expectedSubject,result);return result;
}
function repository(cloud: boolean, expectedSubject: string): Repository {
  const methods = Object.fromEntries(names.map(name=>[name,async (...args: unknown[])=>{
    const target = cloud ? await getRemote(expectedSubject) : local;
    return (target[name] as (...values: unknown[])=>unknown)(...args);
  }])) as Methods;
  return {...methods,cloud,
    async currentTerms(){return cloud?(await getRemote(expectedSubject)).currentTerms():null;},
    async acceptTerms(terms){if(cloud)await (await getRemote(expectedSubject)).acceptTerms(terms);},
    async publishMediaArticle(id,attestation){
    if(cloud)throw new Error("公開機能は利用条件の初回同意と公開版確認の接続を準備中です。下書きは保存できます。");
    return local.publishMediaArticle(id);
  }};
}
export function useMediaRepository() {
  const {profile}=useAuth();
  const expectedSubject=profile.user_id;
  const params = useSearchParams();
  const cloud = !(process.env.NODE_ENV === "development" && params.get("preview") === "integration");
  return useMemo(()=>repository(cloud,expectedSubject),[cloud,expectedSubject]);
}
