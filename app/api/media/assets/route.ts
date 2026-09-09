import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import { mediaImageContext } from "@/lib/media-app/private-image-server";
export const runtime="nodejs";
const maxBytes=3*1024*1024;
const reply=(status:number,message:string)=>Response.json({message},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request: Request) {
  try {
    const context=await mediaImageContext(request);if(!context)return reply(401,"ログイン状態を確認してください。");
    if(request.headers.get("content-type")!=="image/webp"||!request.body)return reply(400,"WebP画像を選択してください。");
    const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();return reply(413,"画像を3MB以下にしてください。");}chunks.push(value);}
    const source=Buffer.concat(chunks);
    const metadata=await sharp(source,{limitInputPixels:25_000_000}).metadata();
    if(metadata.format!=="webp"||(metadata.pages??1)>1)return reply(400,"静止画のWebPを選択してください。");
    const bytes=await sharp(source,{limitInputPixels:25_000_000}).rotate().resize({width:2000,height:2000,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer();
    if(bytes.byteLength>maxBytes)return reply(413,"画像を3MB以下にしてください。");
    const path=`${context.ownerId}/media/${randomBytes(32).toString("hex")}.webp`;
    const {error:uploadError}=await context.admin.storage.from(context.bucket).upload(path,bytes,{contentType:"image/webp",upsert:false,cacheControl:"0"});
    if(uploadError)return reply(503,"画像を保存できませんでした。");
    const args={p_owner_id:context.ownerId,p_storage_path:path,p_byte_size:bytes.byteLength,p_content_sha256:createHash("sha256").update(bytes).digest("hex"),p_original_name:"image.webp"};
    let result=await context.admin.rpc("media_register_private_image",args);
    const firstErrorCode=result.error?.code;
    if(result.error)result=await context.admin.rpc("media_register_private_image",args);
    // A lost response may already have committed. Never remove a potentially bound object here.
    if(firstErrorCode==="P0001"&&result.error?.code==="P0001")await context.admin.storage.from(context.bucket).remove([path]);
    if(result.error||typeof result.data?.assetId!=="string"||!/^[a-f0-9-]{36}$/.test(result.data.assetId))return reply(503,"画像の登録結果を確認できませんでした。もう一度お試しください。");
    return Response.json({assetId:result.data.assetId,imageUrl:`/api/media/assets/${result.data.assetId}`},{headers:{"Cache-Control":"no-store"}});
  } catch {return reply(400,"画像を確認できませんでした。別の画像を選択してください。");}
}
