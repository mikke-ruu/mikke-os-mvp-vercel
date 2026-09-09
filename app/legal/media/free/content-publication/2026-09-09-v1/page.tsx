import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Media Free 投稿ルール" };
export default function Page() { return <LegalMarkdownPage documentName="media-free-content-publication-2026-09-09-v1.md" />; }
