import {PublicHeadquartersInformation} from '@/components/academy2/PublicHeadquartersInformation';
export default async function Page({params}:{params:Promise<{handle:string}>}){const {handle}=await params;return <PublicHeadquartersInformation handle={handle}/>;}
