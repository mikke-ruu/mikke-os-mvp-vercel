'use client';
import {HonbuShell} from '@/components/academy/AcademyShell';
import {useAcademy2Headquarters} from '@/components/academy2/HeadquartersBoundary';
import {HeadquartersTeaching} from '@/components/academy2/HeadquartersTeaching';
function Content(){const hq=useAcademy2Headquarters();return hq?<HeadquartersTeaching headquartersId={hq.id}/>:null;}
export default function Page(){return <HonbuShell title="担当する開催"><Content/></HonbuShell>;}
