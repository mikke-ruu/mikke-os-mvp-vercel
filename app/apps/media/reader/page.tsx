import { AuthGate } from "@/components/AuthGate";
import { MediaReaderPreview } from "@/components/media-app/MediaReaderPreview";

// Inherits the development-only Media route gate; never a public draft route.
export default function MediaReaderPage() {
  return <AuthGate><MediaReaderPreview /></AuthGate>;
}
