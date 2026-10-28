'use client';
import {useCallback,useState} from 'react';
import {Search,ClipboardPen,CalendarCheck,GraduationCap} from 'lucide-react';
import {AcademyFrontHero} from '@/components/academy/AcademyFrontHero';
import {AcademyPublicServices} from '@/components/academy/AcademyPublicServices';
import {PageBlocks} from '@/components/academy/PageBlocks';
import {readFrontDocument,frontMaxWidth} from '@/lib/academy/front-design';
import type {HeadquartersFront} from '@/lib/academy2/headquarters-front';
import type {PublicHomepage} from '@/lib/academy/public-homepage';

type Front=Pick<HeadquartersFront,'id'|'name'|'tagline'|'front_message'|'hero_image_url'|'contact_email'|'front_blocks'|'logo_url'>&{handle?:string};
const steps=[
 {icon:Search,title:'講座を選ぶ',description:'販売ページで内容と受講方法を確認します。'},
 {icon:ClipboardPen,title:'申し込む',description:'申込フォームで日程や条件を確認します。'},
 {icon:CalendarCheck,title:'受講する',description:'お支払いと受講方法は販売ページの案内をご確認ください。'},
 {icon:GraduationCap,title:'受講後のご案内',description:'受講後の流れは各講座の案内をご確認ください。'},
];
/** Public and authenticated previews share a public-field-only presentation. No writes. */
export function HeadquartersHomepagePresentation({front,courses=[],instructors=[]}:{front:Front;courses?:PublicHomepage['courses'];instructors?:PublicHomepage['instructors']}){
 const document=readFrontDocument(front.front_blocks??[]);
 const [available,setAvailable]=useState<{id:string;value:boolean}|null>(null);
 const onAvailability=useCallback((id:string,value:boolean)=>setAvailable({id,value}),[]);
 const hasPlans=available?.id===front.id&&available.value;
 return <main className="min-w-0 bg-white text-[#30383d]" aria-label="本部ホームページの表示">
  <header className="border-b border-[#e2e7e4]"><div className="mx-auto flex min-w-0 flex-wrap items-center justify-between gap-3 px-5 py-4" style={{maxWidth:frontMaxWidth(document.design)}}>{front.logo_url?<img className="max-h-16 max-w-[min(240px,70vw)] object-contain" src={front.logo_url} alt={front.name}/>:<p className="min-w-0 break-words text-lg font-semibold">{front.name}</p>}{hasPlans&&<a className="inline-flex min-h-11 items-center rounded-full bg-[#f75a3b] px-5 text-sm font-semibold text-white" href="#services">講座のご案内</a>}</div></header>
  <AcademyFrontHero hideEmptyImage design={document.design} title={front.tagline||front.name} message={front.front_message||`${front.name}の講座やワークショップをご紹介します。`} imageUrl={front.hero_image_url||''} applicationHref={null} coursesHref={null}/>
  {!!document.blocks.length&&<section className="px-5 py-8"><div className="mx-auto" style={{maxWidth:frontMaxWidth(document.design,768)}}><PageBlocks blocks={document.blocks}/></div></section>}
  <div className="mx-auto px-5" style={{maxWidth:frontMaxWidth(document.design)}}><AcademyPublicServices headquartersId={front.id} heading="講座のご案内" emptyMessage="現在、公開中の販売プランはありません。" description="料金・日程・受付状況は、それぞれの販売ページでご確認ください。" onAvailabilityChange={onAvailability}/></div>
  {!!courses.length&&front.handle&&<section className="mx-auto px-5 py-8" style={{maxWidth:frontMaxWidth(document.design)}}><h2 className="text-center text-xl font-semibold">講座・ワークショップ</h2><ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{courses.map(course=><li key={course.id} className="overflow-hidden rounded-2xl border border-[#e2e7e4]">{course.main_image_url?<img src={course.main_image_url} alt="" className="h-44 w-full object-cover"/>:null}<div className="p-5"><h3 className="text-base font-semibold">{course.name}</h3>{course.subtitle&&<p className="mt-2 text-sm leading-6">{course.subtitle}</p>}<p className="mt-3 text-sm">基本価格 {course.price.toLocaleString()}円{course.duration_text?' ／ '+course.duration_text:''}</p><a className="mt-3 inline-flex min-h-11 items-center text-sm underline" href={'/academy/site/'+encodeURIComponent(front.handle!)+'/course/'+encodeURIComponent(course.id)}>講座の内容を見る</a></div></li>)}</ul></section>}
  {!!instructors.length&&<section className="mx-auto px-5 py-8" style={{maxWidth:frontMaxWidth(document.design)}}><h2 className="text-center text-xl font-semibold">講師紹介</h2><ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{instructors.map(instructor=><li key={instructor.id}><a className="block min-h-11 rounded-2xl border border-[#e2e7e4] p-4 text-center" href={'/academy/i/'+encodeURIComponent(instructor.id)}>{instructor.photo_url?<img className="mx-auto h-14 w-14 rounded-full object-cover" src={instructor.photo_url} alt=""/>:<span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f4ee]">{(instructor.business_name||'講')[0]}</span>}<h3 className="mt-3 text-sm font-semibold">{instructor.business_name||'認定講師'}</h3><p className="mt-1 text-xs">{instructor.area||''}{instructor.online_available?'・オンライン可':''}</p></a></li>)}</ul></section>}
  <section className="mx-auto px-5 py-10" style={{maxWidth:frontMaxWidth(document.design)}}><h2 className="text-center text-xl font-semibold">お申し込みから受講まで</h2><ol className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step,index)=><li className="text-center" key={step.title}><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f4ee] text-[#417d66]"><step.icon size={22}/></span><p className="mt-3 text-xs">STEP {index+1}</p><h3 className="mt-1 text-base font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-relaxed text-[#4b535e]">{step.description}</p></li>)}</ol></section>
  <footer className="border-t border-[#e2e7e4] px-5 py-8 text-center text-sm"><p className="font-semibold">{front.name}</p>{front.contact_email&&<p className="mt-2 break-all">お問い合わせ：{front.contact_email}</p>}<p className="mt-4 text-xs text-[#68716e]">POWERED BY Academy</p></footer>
 </main>;
}
