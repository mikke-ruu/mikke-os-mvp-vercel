import { AuthGate } from "@/components/AuthGate";
import { MediaAppShell } from "@/components/media-app/MediaAppShell";
import { MediaEditor } from "@/components/media-app/MediaEditor";

export default function MediaWritePage() { return <AuthGate><MediaAppShell><MediaEditor /></MediaAppShell></AuthGate>; }
