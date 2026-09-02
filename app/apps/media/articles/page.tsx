import { AuthGate } from "@/components/AuthGate";
import { MediaAppShell } from "@/components/media-app/MediaAppShell";
import { MediaArticleList } from "@/components/media-app/MediaArticleList";

export default function MediaArticlesPage() { return <AuthGate><MediaAppShell><MediaArticleList /></MediaAppShell></AuthGate>; }
