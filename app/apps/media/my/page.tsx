import {AuthGate} from '@/components/AuthGate';
import {MediaAppShell} from '@/components/media-app/MediaAppShell';
import {MyMedia} from '@/components/media-app/MyMedia';
export default function MyMediaPage(){return <AuthGate><MediaAppShell><MyMedia/></MediaAppShell></AuthGate>;}
