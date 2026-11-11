import {PublicSellerDisclosure} from '@/components/academy2/PublicSellerDisclosure';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{returnTo?:string}>}){const {id}=await params;const query=await searchParams;return <PublicSellerDisclosure offeringId={id} applicationBack={query.returnTo==='/academy/o/'+id+'/apply'}/>;}
