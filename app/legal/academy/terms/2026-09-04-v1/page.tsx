import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "mikkeOS Academy 利用規約" };
export default function Page() { return <LegalMarkdownPage documentName="academy-terms-2026-09-04-v1.md" />; }
