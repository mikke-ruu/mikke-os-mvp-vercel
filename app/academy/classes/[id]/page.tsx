'use client';
import {useParams,usePathname,useRouter,useSearchParams} from 'next/navigation';
import {HonbuShell} from '@/components/academy/AcademyShell';
import {Academy2EventForm} from '@/components/academy2/EventForm';
import {Academy2EventDetail} from '@/components/academy2/EventDetail';
export default function EventDetailPage(){
 const params=useParams<{id:string}>(),pathname=usePathname(),router=useRouter(),search=useSearchParams();
 const changeMode=(editing:boolean)=>{const next=new URLSearchParams(search.toString());if(editing)next.set('mode','edit');else next.delete('mode');const suffix=next.toString();router.replace(`${pathname}${suffix?`?${suffix}`:''}`,{scroll:false});};
 return <HonbuShell title="開催">{search.get('mode')==='edit'?<Academy2EventForm key={params.id} eventId={params.id} onBack={()=>changeMode(false)} onSaved={()=>changeMode(false)}/>:<Academy2EventDetail eventId={params.id} onEdit={()=>changeMode(true)}/>}</HonbuShell>;
}
