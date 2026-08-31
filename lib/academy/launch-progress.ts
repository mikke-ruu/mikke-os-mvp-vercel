import type { AcademyHeadquarters, AcademyLpBlock } from "@/types/database";

type Course = { id: string; name: string; is_published: boolean; needsInstructorMaterials: boolean };
type Step = {
  step: number; label: string; description: string; href: string; action: string;
  state: "complete" | "incomplete" | "unconfirmed";
};
const filled = (value: string | null | undefined) => Boolean(value?.trim());
function hasBlockContent(block: AcademyLpBlock) {
  switch (block.type) {
    case "heading": case "text": return filled(block.text);
    case "image": return filled(block.url);
    case "image-text": return filled(block.imageUrl) || filled(block.text);
    case "gallery": return block.images.some((image) => filled(image.url));
    case "cta": return filled(block.heading) && filled(block.buttonLabel) && filled(block.buttonUrl);
  }
}

/** Saved evidence only. No new completion flags, storage, DB reads or publication.
 * A published course proves publication, NOT review of details or the rendered page.
 * Unconfirmed steps intentionally remain until real review evidence is available.
 */
export function getAcademyLaunchProgress({ headquarters, courses, materialCourseIds, instructorCount }: {
  headquarters: Pick<AcademyHeadquarters, "name" | "contact_email" | "front_message" | "front_blocks">;
  courses: readonly Course[]; materialCourseIds: readonly string[]; instructorCount: number;
}) {
  const missingMaterial = courses.find(course => course.needsInstructorMaterials && !materialCourseIds.includes(course.id));
  const draft = courses.find(course => !course.is_published);
  const reviewCourse = missingMaterial ?? draft ?? courses[0];
  const published = courses.find(course => course.is_published);
  const hasFront = filled(headquarters.front_message) || (headquarters.front_blocks ?? []).some(hasBlockContent);
  const basicSaved = filled(headquarters.name) && filled(headquarters.contact_email);
  const steps: Step[] = [
    { step: 1, label: "本部を設定", description: basicSaved ? "団体名と連絡先が登録されています。" : "団体名と連絡先を登録してください。ロゴは任意です。", href: "/academy/settings", action: "本部設定を確認", state: basicSaved ? "complete" : "incomplete" },
    { step: 2, label: "講座を作成", description: courses.length ? "講座が登録されています。" : "6つの質問に答えると、講座の下書きができます。", href: courses.length ? "/academy/courses" : "/academy/courses/new", action: courses.length ? "講座一覧を見る" : "講座の質問へ進む", state: courses.length ? "complete" : "incomplete" },
    {
      step: 3, label: "講座の詳細を設定",
      description: missingMaterial ? `「${missingMaterial.name}」は講師用ファイルを使う設定ですが、まだファイルが登録されていません。`
        : reviewCourse ? `「${reviewCourse.name}」の申込・料金・開催日・教材・認定を確認してください。詳細の確認履歴はまだ記録されていません。`
          : "講座を作成してから、申込・料金・開催日・教材・認定を設定します。",
      href: missingMaterial ? `/academy/materials/new?course=${encodeURIComponent(missingMaterial.id)}` : reviewCourse ? `/academy/courses/${reviewCourse.id}` : "/academy/courses",
      action: missingMaterial ? "講師用ファイルを登録" : "講座の詳細設定へ進む",
      state: !courses.length || missingMaterial ? "incomplete" : "unconfirmed",
    },
    { step: 4, label: "本部ホームページを作成", description: hasFront ? "団体の紹介文・ページ内容が保存されています。公開状態は編集画面で確認してください。" : "団体全体を紹介する文章やページ内容を保存してください。", href: "/academy/front", action: "本部ホームページを編集", state: hasFront ? "complete" : "incomplete" },
    { step: 5, label: "講師を登録", description: instructorCount > 0 ? "講師が登録されています。担当する講座は講師管理で確認できます。" : "本部オーナー自身が教える場合も、講師として登録できます。", href: "/academy/instructors", action: "講師の登録方法を確認", state: instructorCount > 0 ? "complete" : "incomplete" },
    { step: 6, label: published ? "申込ページを確認" : "公開前に確認", description: published ? "公開済みの申込ページを確認できます。画面を確認した履歴はまだ記録されていません。" : "講座の編集画面で、紹介文と申込内容を確認してください。", href: published ? `/academy/c/${published.id}` : reviewCourse ? `/academy/courses/${reviewCourse.id}` : "/academy/courses", action: published ? "申込ページを確認" : "講座設定を確認", state: "unconfirmed" },
  ];
  const next = steps.find(step => step.state !== "complete")!;
  return { steps: steps.map(step => ({ ...step, isCurrent: step.step === next.step })), next };
}
