import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Media Free 通報・削除・保存" };
export default function Page() { return <LegalMarkdownPage documentName="media-free-report-data-2026-09-09-v1.md" />; }
