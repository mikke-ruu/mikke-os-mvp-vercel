import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Media Free プライバシーポリシー" };
export default function Page() { return <LegalMarkdownPage documentName="media-free-privacy-2026-09-09-v1.md" />; }
