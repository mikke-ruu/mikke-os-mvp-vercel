import {notFound} from 'next/navigation';
import {GuidedSetupReview} from '@/components/academy2/GuidedSetupReview';

export default function SetupReviewPage(){
 if(process.env.NODE_ENV!=='development'||process.env.ACADEMY_SETUP_REVIEW!=='1')notFound();
 return <GuidedSetupReview/>;
}
