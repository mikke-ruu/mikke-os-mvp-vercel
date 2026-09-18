import type { AcademyCourse } from "@/types/database";
import styles from "./academy-course-card.module.css";

export type AcademyCourseCardInfo = Pick<AcademyCourse, "name" | "price"> & Partial<Pick<AcademyCourse, "subtitle" | "main_image_url" | "description" | "can_do_after" | "duration_text" | "kit_contents" | "material_contents" | "certification_conditions">>;

export function AcademyCourseCard({ course, imageSide = "left", priceLabel = "基本価格（税込）" }: { course: AcademyCourseCardInfo; imageSide?: "left" | "right"; priceLabel?: string }) {
  return <article className={styles.card}>
    <div className={styles.layout} data-has-image={Boolean(course.main_image_url)} data-image-side={imageSide}>
      <header className={styles.title}><h2>{course.name || "講座名"}</h2>{course.subtitle && <p>{course.subtitle}</p>}</header>
      {course.main_image_url && <div className={styles.media}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={course.main_image_url} alt={course.name || "講座画像"} /></div>}
      <div className={styles.body}>
        {course.description && <p>{course.description}</p>}
        {course.can_do_after && <section><h3>受講後にできること</h3><p>{course.can_do_after}</p></section>}
        {course.duration_text && <p><strong>所要時間</strong>　{course.duration_text}</p>}
        {course.kit_contents && <section><h3>教材・キット</h3><p>{course.kit_contents}</p></section>}
        {course.material_contents && <section><h3>教材の案内</h3><p>{course.material_contents}</p></section>}
        {course.certification_conditions && <section><h3>認定条件</h3><p>{course.certification_conditions}</p></section>}
        <div className={styles.price}><p>{priceLabel}</p><strong>{Number.isFinite(course.price) ? `¥${course.price.toLocaleString("ja-JP")}` : "価格未入力"}</strong></div>
      </div>
    </div>
  </article>;
}
