import {AuthGate} from '@/components/AuthGate';
import {MediaAppShell} from '@/components/media-app/MediaAppShell';
import {MyMediaProfile} from '@/components/media-app/MyMedia';
export default function MyMediaProfilePage(){return <AuthGate><MediaAppShell><MyMediaProfile/></MediaAppShell></AuthGate>;}
