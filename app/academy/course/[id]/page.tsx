import {Suspense} from 'react';
import {CourseIntroductionPage} from '@/components/academy2/CourseIntroductionPage';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Suspense fallback={<p>講座を読み込み中…</p>}><CourseIntroductionPage id={id}/></Suspense>;}
