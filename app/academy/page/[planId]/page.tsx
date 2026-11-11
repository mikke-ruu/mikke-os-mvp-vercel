import {notFound} from 'next/navigation';
import {PublishedInformationPage} from '@/components/academy2/PublishedInformationPage';
export default async function Page({params}:{params:Promise<{planId:string}>}){const {planId}=await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId))notFound();return <PublishedInformationPage planId={planId}/>;}
