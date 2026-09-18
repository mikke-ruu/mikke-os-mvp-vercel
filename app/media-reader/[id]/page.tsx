import {notFound} from 'next/navigation';
import {MediaPublicReaderProfile} from '@/components/media-app/MediaPublicReaderProfile';
export default async function ReaderProfilePage({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))notFound();return <MediaPublicReaderProfile id={id}/>;}
