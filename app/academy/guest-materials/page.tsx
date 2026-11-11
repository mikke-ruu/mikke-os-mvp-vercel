import {Suspense} from 'react';
import type {Metadata} from 'next';
import {GuestMaterialEntry} from '@/components/academy2/GuestMaterials';
export const metadata:Metadata={referrer:'no-referrer',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<p>教材を確認しています…</p>}><GuestMaterialEntry/></Suspense>;}
