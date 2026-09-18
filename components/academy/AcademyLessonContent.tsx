import type { AcademyPageBlock } from "@/types/database";
import { readLessons } from "@/lib/academy/lesson-content";
import { PageBlocks } from "./PageBlocks";

export function AcademyLessonContent({ blocks }: { blocks: AcademyPageBlock[] }) {
  if (!blocks.some(block => block.type === "heading" && block.lessonId)) return <PageBlocks blocks={blocks} />;
  return <div className="space-y-2">{readLessons(blocks).map((lesson, index) => <details key={`${lesson.id}-${index}`} className="border-b border-[var(--mikke-line)] py-2">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold">{String(index + 1).padStart(2, "0")}　{lesson.title || "新しいレッスン"}</summary>
    <div className="py-3">{lesson.blocks.length ? <PageBlocks blocks={lesson.blocks} /> : <p className="text-sm text-[var(--mikke-muted)]">教材を準備中です。</p>}</div>
  </details>)}</div>;
}
