"use client";
import Link from "next/link";
import { X } from "lucide-react";
import type { AcademyCourse } from "@/types/database";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import styles from "./academy-course-workspace.module.css";
export type AcademyCourseWorkspaceTab = "settings" | "program" | "page" | "learner" | "instructor" | "materials";
export function AcademyCourseWorkspace({ course, activeTab, children }: { course: AcademyCourse; activeTab: AcademyCourseWorkspaceTab; children: React.ReactNode }) {
  const href = (suffix = "") => toCurrentAcademyContextHref(`/academy/courses/${course.id}${suffix}`);
  return <div className={styles.workspace}>
    <Link className={styles.back} href={toCurrentAcademyContextHref("/academy/courses")}><X size={16} />閉じる（講座一覧へ）</Link>
    <header className={styles.heading}><div><span>MY ACADEMY</span><h1>{activeTab === "settings" ? "講座を編集" : activeTab === "learner" ? "レッスン教材" : activeTab === "instructor" ? "講師マニュアル" : "講座を編集"}</h1></div></header>
    {activeTab !== "settings" && <nav className={styles.steps} aria-label="講座作成の手順"><Link href={href()}>1 講座情報</Link><Link href={href("/instructor-page?audience=learner")} aria-current={activeTab === "learner" ? "step" : undefined}>2 レッスン教材</Link></nav>}
    {children}
    <details className={styles.other}><summary>講師マニュアル・表示確認</summary><nav>
      <Link href={href("/instructor-page")}>講師マニュアル</Link>
      <Link href={toCurrentAcademyContextHref(`/academy/materials?course=${course.id}`)}>講師用ファイル</Link>
      <Link href={href("/portal-preview")}>受講者・講師の表示を確認</Link>
    </nav></details>
  </div>;
}
