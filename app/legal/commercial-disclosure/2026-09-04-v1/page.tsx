import type { Metadata } from "next";
import { LegalMarkdownPage } from "@/components/legal/LegalMarkdownPage";

export const metadata: Metadata = { title: "特定商取引法に基づく表記" };
export default function Page() { return <LegalMarkdownPage documentName="commercial-disclosure-2026-09-04-v1.md" />; }
