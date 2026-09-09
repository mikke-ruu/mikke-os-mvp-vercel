import { AuthGate } from "@/components/AuthGate";
import { MediaAppShell } from "@/components/media-app/MediaAppShell";
import { MediaDraftPreview } from "@/components/media-app/MediaDraftPreview";

export default function MediaPreviewPage() { return <AuthGate><MediaAppShell><MediaDraftPreview /></MediaAppShell></AuthGate>; }
