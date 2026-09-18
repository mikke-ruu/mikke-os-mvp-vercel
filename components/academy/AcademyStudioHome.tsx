"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { AcademyOfferingSummary } from "./AcademyOfferingSummary";
import { AcademyGettingStarted } from "./AcademyGettingStarted";
import { toCurrentAcademyContextHref as href } from "@/lib/academy/access-context";
import type { AcademyCourse } from "@/types/database";
import styles from "./academy-studio-home.module.css";

export function AcademyStudioHome({ name, courses, pendingCount, guideScope = "local-review" }: { name: string; courses: AcademyCourse[]; pendingCount: number; guideScope?: string }) {
  const activities = [
    ["募集をつくる・編集する", "講座を組み合わせて募集ページへ", "/academy/offerings"],
    ["申込・入金を確認する", "新しい募集ページからの申込", "/academy/offering-applications"],
    ["講師管理", "認定・登録状況を確認", "/academy/instructors"],
    ["開催日程・担当講師", "日時と担当者を確認", "/academy/classes"],
    ["教材注文", "講師からの注文と発送を確認", "/academy/kits"],
  ];
  return <div className={styles.overview}>
    <header className={styles.welcome}><div><span className={styles.kicker}>MY ACADEMY</span><h2>{name || "運営ホーム"}</h2><p>講座を整えて、募集をはじめましょう。</p><Link className={styles.primary} href={href("/academy/courses/new")}><Plus size={17} />講座をつくる</Link></div><div className={styles.summary}><span>登録している講座</span><strong>{courses.length}<small>講座</small></strong></div></header>
    <AcademyOfferingSummary />
    <div className={styles.workspace}>
      <section><div className={styles.sectionHead}><h2>運営のメニュー</h2></div><nav className={styles.menu} aria-label="運営のメニュー">{activities.map(([title, detail, path]) => <Link key={path} href={href(path)}><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16} /></Link>)}</nav></section>
      <aside><details className={styles.setup} open={courses.length === 0}><summary>はじめの設定</summary><AcademyGettingStarted key={guideScope} empty={courses.length === 0} scope={guideScope} /></details></aside>
    </div>
    <section><div className={styles.sectionHead}><h2>講座の編集を続ける</h2><Link href={href("/academy/courses")}>講座一覧 →</Link></div><div className={styles.courses}>{courses.length ? courses.slice(0,3).map(course => <Link key={course.id} className={styles.course} href={href("/academy/courses/" + course.id)}><span className={styles.cover}>{course.main_image_url ? <img src={course.main_image_url} alt="" /> : <BookOpen size={23} />}</span><span><strong>{course.name}</strong></span><ArrowRight size={15} /></Link>) : <p className={styles.empty}>講座をつくると、ここから編集を続けられます。</p>}</div></section>
    <nav className={styles.reviewLinks} aria-label="その他の運営メニュー"><Link href={href("/academy/front")}>ホームページ編集</Link><Link href={href("/academy/settings")}>本部設定</Link></nav>
  </div>;
}
