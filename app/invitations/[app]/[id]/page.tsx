import {Suspense} from 'react';
import {notFound} from 'next/navigation';
import {AuthGate} from '@/components/AuthGate';
import {InvitationLanding} from '@/components/mikkeos/InvitationLanding';
export default async function Page({params}:{params:Promise<{app:string;id:string}>}){
 const {app,id}=await params;
 if((app!=='academy'&&app!=='team-works')||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))notFound();
 return <Suspense fallback={<p>招待を確認中…</p>}><AuthGate><InvitationLanding app={app} id={id}/></AuthGate></Suspense>;
}
