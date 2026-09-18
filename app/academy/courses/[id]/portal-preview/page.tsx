"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { PageBlocks } from "@/components/academy/PageBlocks";
import { AcademyLessonContent } from "@/components/academy/AcademyLessonContent";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import { getLearnerPage } from "@/lib/academy/learner-page";
import { getInstructorPage } from "@/lib/academy/instructor-page";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import type { AcademyCourse, AcademyPageBlock } from "@/types/database";

function Preview({id}:{id:string}) {
  const {profile} = useAuth();
  const [data,setData] = useState<{course:AcademyCourse;learner:AcademyPageBlock[];instructor:AcademyPageBlock[];published:boolean}|null>(null);
  const [error,setError] = useState(false);
  const [view,setView] = useState<"learner"|"instructor">("learner");
  useEffect(()=>{let active=true;setData(null);setError(false);
    async function load(){try{
      const hq=await getOwnedHeadquarters(profile.user_id);
      if(!hq) throw Error("unavailable");
      const course=await getCourse(hq.id,id);
      if(!course) throw Error("unavailable");
      const [learner,instructor]=await Promise.all([getLearnerPage(hq.id,id),getInstructorPage(hq.id,id)]);
      if(active)setData({course,learner:learner?.blocks??[],instructor:instructor?.blocks??[],published:learner?.is_published??false});
    }catch{if(active)setError(true);}}
    void load();return()=>{active=false;};
  },[id,profile.user_id]);
  const back=toCurrentAcademyContextHref("/academy/courses");
  if(error)return <div role="alert"><p>この講座の表示を確認できませんでした。</p><Link href={back}>講座一覧へ戻る</Link></div>;
  if(!data)return <p>読み込み中…</p>;
  const title=view==="learner"?"講座復習ページ":"講師マニュアルページ";
  const blocks=(view==="learner"?data.learner:data.instructor).filter(b=>b.type!=="materials-list");
  return <div className="mx-auto max-w-3xl space-y-3 text-[var(--mikke-text)]">
    <Link href={back} className="inline-flex min-h-10 items-center text-sm font-bold">← 講座一覧へ戻る</Link>
    <h2 className="text-base font-bold">受講生・講師の表示確認</h2>
    <p className="text-sm leading-5">本部向けのサンプルです。他の人のアカウントには入りません。保存済みのページ内容を、閲覧権限がある場合の見本として表示します。</p>
    <div className="flex gap-2" aria-label="確認する立場">{([['learner','受講生'],['instructor','講師']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={view===value} onClick={()=>setView(value)} className="min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 text-sm font-bold aria-pressed:border-[var(--mikke-primary)]">{label}</button>)}</div>
    <section className="space-y-3 rounded-lg border border-[var(--mikke-line)] bg-white p-3">
      <p className="text-xs font-bold">{view==="learner"?"受講生ポータル":"講師ポータル"} · この講座の表示見本</p>
      <h3 className="font-bold">{data.course.name}</h3>
      <p className="text-xs">個人情報・申込履歴・期限判定は見本に含みません。ポータル全体の完全な再現ではありません。</p>
      <h4 className="border-l-2 border-[var(--mikke-pink)] pl-2 font-bold">{title}</h4>
      {view==="learner"&&!data.published?<p className="text-sm font-bold">下書きの確認中です。受講生にはまだ表示されません。</p>:null}
      {blocks.length ? view === "learner" ? <AcademyLessonContent blocks={blocks}/> : <PageBlocks blocks={blocks}/> : <p className="text-sm">このページの内容はまだありません。</p>}
    </section>
    <p className="text-xs leading-5">実際の表示は本人の受講・講師登録と閲覧期限によって変わります。限定PDFの取得と教材一覧は、実際の権限付き画面で確認します。</p>
    <Link href={toCurrentAcademyContextHref(`/academy/courses/${id}/instructor-page${view==="learner"?"?audience=learner":""}`)} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--mikke-line)] px-3 text-sm font-bold">{title}を編集する →</Link>
  </div>;
}
function Identity({id}:{id:string}) {const {profile}=useAuth();return <Preview key={`${profile.user_id}:${id}`} id={id}/>;}
export default function CoursePortalPreview({params}:{params:Promise<{id:string}>}){const {id}=use(params);return <HonbuShell title="受講生・講師の表示確認"><Identity id={id}/></HonbuShell>;}
