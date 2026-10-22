'use client';
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {HonbuShell} from '@/components/academy/AcademyShell';
import {CommonCreation} from '@/components/academy2/CommonCreation';
function CreationRoute(){const params=useSearchParams();return <CommonCreation key={params.toString()}/>;}
export default function Page(){return <HonbuShell title="講座・販売プラン・開催を作る"><Suspense fallback={<p>読み込み中…</p>}><CreationRoute/></Suspense></HonbuShell>;}
