import { AuthGate } from "@/components/AuthGate";
import { MediaAppShell } from "@/components/media-app/MediaAppShell";
import { MediaDashboard } from "@/components/media-app/MediaDashboard";

export default function MediaPage() { return <AuthGate><MediaAppShell><MediaDashboard /></MediaAppShell></AuthGate>; }
