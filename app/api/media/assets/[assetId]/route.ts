import { mediaImageContext } from "@/lib/media-app/private-image-server";
import { imageNotFound, publicImageResponse, type PublicImageLocator } from "@/lib/media-app/public-image-response";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request: Request, {params}:{params:Promise<{assetId:string}>}) {
  try {
    const {assetId}=await params;
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(assetId))return imageNotFound();
    const context=await mediaImageContext(request);if(!context)return imageNotFound();
    return publicImageResponse(assetId.replaceAll("-",""),context.bucket,async()=>{
      const {data,error}=await context.admin.rpc("media_resolve_owner_image",{p_owner_id:context.ownerId,p_asset_id:assetId});
      return error||!data||Array.isArray(data)?null:data as PublicImageLocator;
    }, locator=>fetch(`${context.url}/storage/v1/object/authenticated/${locator.bucket}/${locator.storagePath.split("/").map(encodeURIComponent).join("/")}`,{
      headers:{Authorization:`Bearer ${context.secret}`,apikey:context.secret},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000),
    }));
  }catch{return imageNotFound();}
}
