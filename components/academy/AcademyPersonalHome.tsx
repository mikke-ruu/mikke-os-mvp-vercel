"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { QrCode } from "./QrCode";
import { toCurrentAcademyContextHref as href } from "@/lib/academy/access-context";
import type { AcademyApplication, AcademyCourse, AcademyInstructor } from "@/types/database";
import styles from "./academy-personal-home.module.css";

export function AcademyPersonalHome({ name, view, records, learnerApps, courses, canSwitch, onSwitch }: {
  name: string; view: "learner" | "instructor"; records: AcademyInstructor[];
  learnerApps: AcademyApplication[]; courses: Record<string, AcademyCourse>;
  canSwitch: boolean; onSwitch: (view: "learner" | "instructor") => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const teaching = view === "instructor";
  const active = records.filter(record => record.is_active && record.status === "active");
  const learnerIds = [...new Set(learnerApps.map(application => application.course_id))];
  return <div className={styles.root}>
    <header className={styles.home}><small>MY ACADEMY</small><h1>{name}さんのマイページ</h1></header>
    {canSwitch && <nav className={styles.tabs} aria-label="マイページの表示切り替え"><button type="button" aria-pressed={!teaching} onClick={() => onSwitch("learner")}>受講する</button><button type="button" aria-pressed={teaching} onClick={() => onSwitch("instructor")}>教える</button></nav>}
    <section className={styles.intro}><h2>{teaching ? "教える・案内する" : "受講する講座"}</h2><p>{teaching ? "本部の講座情報から募集ページを作り、申込や担当依頼を確認します。" : "教材を開くと、受講した講座の続きを確認できます。"}</p></section>
    <nav className={styles.menu} aria-label="マイメニュー">
      <Link href={href(`/academy/portal/study?view=${view}`)}>{teaching ? "講師マニュアル" : "レッスン・教材"}</Link>
      <Link href={href("/academy/offering-applications/mine")}>自分の申込・支払い</Link>
      {teaching && active.length > 0 && <><Link href={href("/academy/portal/offerings")}>募集ページ</Link><Link href={href("/academy/portal/offering-applications")}>募集の申込</Link><Link href={href("/academy/portal/class-requests")}>担当依頼</Link><a href="#personal-profile">プロフィール・QR</a></>}
    </nav>
    <section className={styles.section}><h2>{teaching ? "認定・登録している講座" : "受講中・修了した講座"}</h2><div className={styles.list}>
      {teaching ? records.map(record => { const course = courses[record.course_id]; return <article className={styles.course} key={record.id}>
        <div className={styles.cover}>{course?.main_image_url ? <img src={course.main_image_url} alt="" /> : <BookOpen size={26} />}</div><div className={styles.courseBody}><h3>{course?.name ?? "講座情報を確認してください"}</h3><p>{record.is_certified ? "認定済み" : "登録済み"} ／ {record.is_active && record.status === "active" ? "活動中" : "登録状況を確認してください"}{record.instructor_number ? ` ／ No.${record.instructor_number}` : ""}</p><div className={styles.actions}><Link href={href(`/academy/portal/study?view=instructor&course=${encodeURIComponent(record.course_id)}`)}>マニュアルを見る</Link>{record.is_active && record.status === "active" && <Link href={href("/academy/portal/offerings")}>募集ページを作る →</Link>}</div></div>
      </article>; }) : learnerIds.map(id => { const course = courses[id]; const application = learnerApps.find(item => item.course_id === id); return <article key={id} className={styles.course}><div className={styles.cover}>{course?.main_image_url ? <img src={course.main_image_url} alt="" /> : <BookOpen size={26} />}</div><div className={styles.courseBody}><h3>{course?.name ?? "講座情報を確認してください"}</h3><p>{["completed", "certified", "instructor_added"].includes(application?.status ?? "") ? "修了済み" : "受講状況を確認"}</p><Link href={href(`/academy/portal/study?view=learner&course=${encodeURIComponent(id)}`)}>教材を見る →</Link></div></article>; })}
      {(teaching ? records.length === 0 : learnerIds.length === 0) && <p>表示できる講座はまだありません。申込状況は「自分の申込・支払い」で確認できます。</p>}
    </div></section>
    {teaching && active.length > 0 && <section id="personal-profile" className={styles.section}><h2>プロフィール・紹介URL・QR</h2><p>講座ごとの営業プロフィールと紹介ページを確認できます。</p>{active.map(record => <details key={record.id} className={styles.profile}><summary>{record.business_name || name} ／ {courses[record.course_id]?.name ?? "講座"}</summary><p className={styles.description}>{record.self_intro || "プロフィールを入力すると、紹介ページに表示されます。"}</p><div className={styles.share}><div><Link href={href("/academy/portal/url")}>プロフィールを編集</Link><Link href={`/academy/i/${record.id}`} target="_blank" rel="noopener noreferrer">お客様向けの紹介ページを見る ↗</Link>{origin && <p className={styles.url}>{origin}/academy/i/{record.id}</p>}<small>募集のLPは「募集ページ」で本部の募集を選んで作成します。</small></div>{origin && <QrCode url={`${origin}/academy/i/${record.id}`} filename={`academy-${record.id}`} />}</div></details>)}</section>}
    <nav className={styles.menu} aria-label="その他のメニュー"><Link href="/community">Community</Link>{teaching && active.length > 0 && <><Link href={href("/academy/portal/kits")}>教材注文</Link><Link href={href("/academy/portal/applications")}>従来の申込</Link><Link href={href("/academy/portal/study?view=learner")}>自分の受講教材</Link></>}</nav>
  </div>;
}
