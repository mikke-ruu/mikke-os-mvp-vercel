import type { AcademyPageBlock } from "@/types/database";

export type AcademyLesson = { id: string; title: string; blocks: AcademyPageBlock[]; marker?: AcademyPageBlock };

// Keep all pre-renewal blocks intact. Only explicit lesson markers split content;
// ordinary headings inside a lesson are never interpreted as another lesson.
export function readLessons(blocks: AcademyPageBlock[], curriculum: string[] = []): AcademyLesson[] {
  const lessons: AcademyLesson[] = [];
  for (const block of blocks) {
    if (block.type === "heading" && block.lessonId) {
      lessons.push({ id: block.lessonId, title: block.text, blocks: [], marker: block });
    } else {
      if (!lessons.length) lessons.push({ id: "legacy-material", title: "これまでの教材", blocks: [] });
      lessons[lessons.length - 1].blocks.push(block);
    }
  }
  if (!blocks.length) return curriculum.map((title, i) => ({ id: `curriculum-${i}`, title, blocks: [] }));
  return lessons;
}

export function writeLessons(lessons: AcademyLesson[]): AcademyPageBlock[] {
  return lessons.flatMap(lesson => [
    { ...lesson.marker, type: "heading" as const, text: lesson.title, lessonId: lesson.id },
    ...lesson.blocks
  ]);
}

export function moveLesson(lessons: AcademyLesson[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (index < 0 || index >= lessons.length || target < 0 || target >= lessons.length) return lessons;
  const result = [...lessons];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
