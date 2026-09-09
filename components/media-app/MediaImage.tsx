"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
const privatePath=/^\/api\/media\/assets\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Props={src:string;alt:string;className?:string};
function OwnerImage(props:Props){
  const {profile}=useAuth();const [image,setImage]=useState<{subject:string;src:string;url:string}|null>(null);
  useEffect(()=>{let alive=true;let url="";const controller=new AbortController();
    void(async()=>{try{const {data}=await supabase.auth.getSession();if(!data.session||data.session.user.id!==profile.user_id)return;
      const response=await fetch(props.src,{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:"no-store",signal:controller.signal});
      if(!response.ok)return;const blob=await response.blob();const latest=await supabase.auth.getUser();
      if(!alive||latest.data.user?.id!==profile.user_id)return;url=URL.createObjectURL(blob);setImage({subject:profile.user_id,src:props.src,url});
    }catch{}})();return()=>{alive=false;controller.abort();if(url)URL.revokeObjectURL(url);};
  },[props.src,profile.user_id]);
  return image?.subject===profile.user_id&&image.src===props.src?<img {...props} src={image.url}/>:<span className="block p-4 text-sm text-[var(--mikke-muted)]">画像を確認しています</span>;
}
export function MediaImage(props:Props){
  if(/[\r\n]/.test(props.src))return null;
  if(privatePath.test(props.src)&&!/[\r\n]/.test(props.src))return <OwnerImage {...props}/>;
  if(!props.src.startsWith("https://")&&!/^\/media\/images\/[a-f0-9]{64}$/.test(props.src))return null;
  return <img {...props}/>;
}
