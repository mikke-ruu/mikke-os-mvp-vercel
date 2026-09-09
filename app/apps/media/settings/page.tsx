import { AuthGate } from "@/components/AuthGate";
import { MediaAppShell } from "@/components/media-app/MediaAppShell";
import { MediaSettings } from "@/components/media-app/MediaSettings";

export default function MediaSettingsPage() { return <AuthGate><MediaAppShell><MediaSettings /></MediaAppShell></AuthGate>; }
