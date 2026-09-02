import { AuthGate } from "@/components/AuthGate";
import { MediaAppShell } from "@/components/media-app/MediaAppShell";
import { MediaSetupForm } from "@/components/media-app/MediaSetupForm";

export default function NewMediaPage() { return <AuthGate><MediaAppShell><MediaSetupForm /></MediaAppShell></AuthGate>; }
