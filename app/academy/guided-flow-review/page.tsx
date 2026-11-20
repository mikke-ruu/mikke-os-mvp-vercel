import {notFound} from 'next/navigation';
import {Suspense} from 'react';
import {AcademyFlowReview} from '@/components/academy2/AcademyFlowReview';
export const metadata={robots:{index:false,follow:false}};
export default function Page(){if(process.env.NODE_ENV!=='development'||process.env.ACADEMY_SETUP_REVIEW!=='1')notFound();return <Suspense fallback={<p>読み込み中…</p>}><AcademyFlowReview/></Suspense>;}
