import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createMediaPublicReader, mediaCanonicalPath } from "@/lib/media-app/public-contract";
import { createMediaPublicRpcTransport } from "@/lib/media-app/public-rpc";
import { fakeMediaPublicTransport } from "@/lib/media-app/fake-public-transport";

const developmentReader = createMediaPublicReader(fakeMediaPublicTransport);
function reader(mediaSlug: string) {
  if (process.env.NODE_ENV === "development" && mediaSlug === "mikkeos-media-preview") return developmentReader;
  // Enable only after production SQL/public DTO/legal gates pass. No authenticated
  // cookie or privileged client is ever reused on this anonymous read path.
  if (process.env.MEDIA_PUBLIC_DATABASE_ENABLED !== "true") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
  return createMediaPublicReader(createMediaPublicRpcTransport(async (name, args) => {
    const {data,error} = await client.rpc(name,args);
    return {data,error};
  }));
}
export async function loadPublicMediaSite(mediaSlug: string, locale?: string) {
  if (!mediaCanonicalPath(mediaSlug)) return null;
  return reader(mediaSlug)?.site(mediaSlug,locale) ?? null;
}
export async function loadPublicMediaArticles(mediaSlug: string, locale?: string) {
  if (!mediaCanonicalPath(mediaSlug)) return [];
  return reader(mediaSlug)?.articles(mediaSlug,locale) ?? [];
}
export async function loadPublicMediaArticle(mediaSlug: string, articleSlug: string, locale?: string) {
  if (!mediaCanonicalPath(mediaSlug,articleSlug)) return null;
  const article=await reader(mediaSlug)?.article(mediaSlug,articleSlug,locale)??null;
  if(!article)return null;
  if(process.env.NODE_ENV==="development"&&mediaSlug==="mikkeos-media-preview")return article;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
  const {data,error}=await client.rpc("media_public_article_categories",{p_site_slug:mediaSlug,p_article_slug:articleSlug,p_revision_hash:article.revisionHash});
  if(error||!Array.isArray(data)||data.length>100||!data.every(c=>typeof c==="string"&&c.length<=60))return null;
  return {...article,categories:data as string[]};
}

export async function loadPublicMediaPage(mediaSlug:string,filters:import("./public-page").PublicMediaPageFilters){
 if(process.env.NODE_ENV==="development"&&mediaSlug==="mikkeos-media-preview"){
  const articles=await developmentReader.articles(mediaSlug)??[];
  const filtered=articles.filter(a=>(!filters.query||a.title.includes(filters.query))&&(!filters.category||a.categoryName===filters.category)&&(!filters.month||a.publishedAt.startsWith(filters.month)));
  return {total:filtered.length,items:filtered.slice((filters.page-1)*12,filters.page*12).map(article=>({article,categories:[article.categoryName].filter(Boolean),pinned:false,publicationOrder:0,displayDate:article.publishedAt}))};
 }
 if(!mediaCanonicalPath(mediaSlug)||process.env.MEDIA_PUBLIC_DATABASE_ENABLED!=="true")return null;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)return null;
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
 const {data,error}=await client.rpc("media_public_article_page",{p_site_slug:mediaSlug,p_page:filters.page,p_query:filters.query,p_category:filters.category,p_month:filters.month,p_collection:filters.collection||null});
 if(error)return null;const {parsePublicMediaPage}=await import("./public-page");return parsePublicMediaPage(data);
}
