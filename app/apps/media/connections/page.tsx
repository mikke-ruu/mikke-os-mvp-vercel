import { AuthGate } from "@/components/AuthGate";
import { MediaAppShell } from "@/components/media-app/MediaAppShell";
import { MediaConnectionPreview } from "@/components/media-app/MediaConnectionPreview";
export default function MediaConnectionsPage() {
  return <AuthGate><MediaAppShell><MediaConnectionPreview /></MediaAppShell></AuthGate>;
}
