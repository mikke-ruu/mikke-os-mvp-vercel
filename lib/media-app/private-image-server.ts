import "server-only";
import { createClient } from "@supabase/supabase-js";

export async function mediaImageContext(request: Request) {
  if (process.env.MEDIA_PRIVATE_ASSETS_ENABLED !== "true") return null;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token=request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!url||!anon||!secret||!token)return null;
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const auth=createClient(url,anon,options);
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data.user||data.user.is_anonymous)return null;
  return {ownerId:data.user.id,admin:createClient(url,secret,options),url,secret,bucket:"mikke-media-private"};
}
