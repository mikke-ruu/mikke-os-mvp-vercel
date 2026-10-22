import {PublicSellerDisclosure} from '@/components/academy2/PublicSellerDisclosure';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PublicSellerDisclosure offeringId={id}/>;}
