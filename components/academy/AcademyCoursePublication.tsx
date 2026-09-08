"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { createFirstPublicationAccessRpc, createFirstPublicationCourseRpc, type FirstPublicationAccess } from "@/lib/academy/first-publication/access-client";
import { createFirstPublicationRpc, type FirstPublicationStatus } from "@/lib/academy/first-publication/rpc-client";
import type { AcademyCourse } from "@/types/database";
import { AcademyPublicationPanel } from "./AcademyPublicationPanel";
import { AcademyFirstPublicationPanel } from "./AcademyFirstPublicationPanel";

type Props = {
  headquartersId: string; userId: string; ownerUserId: string;
  course: AcademyCourse; sample: boolean;
  onLegacyChange: (published: boolean) => Promise<void>;
  onReloadCourse: () => Promise<void>;
};

export function AcademyCoursePublication(props: Props) {
  if (props.sample) return <AcademyPublicationPanel course={props.course} sample onChange={props.onLegacyChange} />;
  return <Identity key={`${props.userId}:${props.headquartersId}:${props.course.id}`} {...props} />;
}
function Identity(props: Props) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.user.id === props.userId ? session.access_token : null);
    });
    return () => data.subscription.unsubscribe();
  }, [props.userId]);
  if (!token) return <p role="status" className="py-4 text-sm">公開前にログイン状態を確認しています。</p>;
  return <Connected key={token} {...props} />;
}
function Connected(props: Props) {
  const {headquartersId,userId,ownerUserId,course,onReloadCourse,onLegacyChange}=props;
  const [load, setLoad] = useState<{kind:"loading"}|{kind:"error"}|{kind:"ready";access:FirstPublicationAccess|null;status:FirstPublicationStatus|null}>({kind:"loading"});
  const mounted=useRef(true);
  const generation=useRef(0);
  const owner=userId===ownerUserId;
  const refresh=useCallback(async()=>{
    const turn=++generation.current;
    try {
      const access=await createFirstPublicationAccessRpc(supabase)(headquartersId);
      const status=access && owner && access.phase!=="expired"
        ? await createFirstPublicationRpc(supabase)(headquartersId,{action:"status"}) : null;
      if (mounted.current && turn===generation.current) setLoad({kind:"ready",access,status});
    } catch (error) {
      if (mounted.current && turn===generation.current) setLoad({kind:"error"});
      throw error;
    }
  },[headquartersId,owner]);
  useEffect(()=>{
    mounted.current=true;
    void refresh().catch(()=>{});
    return ()=>{mounted.current=false;generation.current++;};
  },[refresh]);
  if(load.kind==="loading")return <p role="status" className="py-4 text-sm">公開に必要な契約状態を確認しています…</p>;
  if(load.kind==="error")return <section className="rounded-lg border border-[var(--mikke-line)] p-4 text-sm"><p role="alert">契約状態を確認できないため公開操作を停止しています。未契約という意味ではありません。</p><button type="button" className="mt-2 min-h-11 px-3 text-[var(--mikke-primary)]" onClick={()=>void refresh().catch(()=>{})}>契約状態を再確認</button></section>;
  if(load.access===null)return <AcademyPublicationPanel course={course} sample={false} onChange={onLegacyChange}/>;
  const settingsHref=`/academy/h/${encodeURIComponent(headquartersId)}/manage/settings`;
  if (!owner && load.access.active) return <div className="space-y-3"><p className="text-sm leading-7">講座の公開状態を変更できます。利用契約や無料期間の起点は変わりません。契約操作は本部責任者が行います。</p><AcademyPublicationPanel course={course} sample={false} onChange={async published => {
    await createFirstPublicationCourseRpc(supabase)(headquartersId, course.id, published);
    if (!mounted.current) return;
    await onReloadCourse();
    await refresh();
  }} /></div>;
  if(load.access.phase==="expired" || !owner || !load.status)return <section className="rounded-lg border border-[var(--mikke-line)] p-4 text-sm"><p>{!owner?"新制度の公開・契約操作は本部責任者が行います。":load.access.phase==="expired"?"利用期間が終了しています。契約状態を確認してください。":"初公開の前に、料金と支払方法を本部設定で確認してください。"}</p><Link href={settingsHref} className="mt-2 inline-flex min-h-11 items-center text-[var(--mikke-primary)]">本部設定で利用契約を確認 →</Link></section>;
  const status=load.status;
  const allowedActions:Array<"publish"|"unpublish"|"cancel_conversion">=[];
  if (load.access.active || status.phase==="prepared") allowedActions.push(course.is_published?"unpublish":"publish");
  if (load.access.phase!=="paid" && status.cancellationAcceptedAt===null && status.phase!=="attention") allowedActions.push("cancel_conversion");
  return <div className="space-y-3">{status.firstPublishedAt === null ? <p className="text-sm leading-7">料金見積もりには30分の有効期限があります。準備から時間が経った場合や公開を完了できない場合は、<Link href={settingsHref} className="text-[var(--mikke-primary)] underline">本部設定で料金と支払方法を確認し直してください</Link>。講座の下書きは残ります。</p> : null}<AcademyFirstPublicationPanel identityKey={userId} state={status} access={load.access} course={course} allowedActions={allowedActions} onRefresh={async()=>{await onReloadCourse();await refresh();}} onAction={async action=>{
    if (action !== "cancel_conversion" && status.firstPublishedAt !== null) await createFirstPublicationCourseRpc(supabase)(headquartersId, course.id, action === "publish");
    else if(action==="publish")await createFirstPublicationRpc(supabase)(headquartersId,{action,courseId:course.id,quoteId:status.quoteId,confirmed:true});
    else if(action==="unpublish")await createFirstPublicationRpc(supabase)(headquartersId,{action,courseId:course.id});
    else await createFirstPublicationRpc(supabase)(headquartersId,{action});
    if(!mounted.current)return;
    await onReloadCourse();
    await refresh();
  }}/></div>;
}
