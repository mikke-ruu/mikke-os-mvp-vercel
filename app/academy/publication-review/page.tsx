import {notFound} from 'next/navigation';
import {PublicationReview} from './review';
export const metadata={robots:{index:false,follow:false}};
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <PublicationReview/>;}
