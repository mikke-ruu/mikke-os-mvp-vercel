"use client";
import { useEffect, useState } from "react";
import type { AcademyCourse, AcademyCourseMarketing } from "@/types/database";
import { courseMarketing, courseImages } from "@/lib/academy/course-marketing";
import styles from "./academy-course-card.module.css";

export type AcademyCourseCardInfo = Pick<AcademyCourse, "name" | "price"> & Partial<Pick<AcademyCourse, "subtitle" | "main_image_url" | "description" | "can_do_after" | "duration_text" | "kit_contents" | "material_contents" | "certification_conditions" | "feature_settings">> & { marketing?: AcademyCourseMarketing };

export function AcademyCourseCard({ course, imageSide, priceLabel = "基本価格（税込）", hidePrice = false }: { course: AcademyCourseCardInfo; imageSide?: "left" | "right"; priceLabel?: string; hidePrice?: boolean }) {
  const marketing = courseMarketing(course.marketing ?? course.feature_settings?.marketing);
  const images = courseImages(marketing, course.main_image_url);
  const curriculum = marketing.curriculum?.filter(item => item.trim()) ?? [];
  const [slide, setSlide] = useState(0);
  const imageKey = images.join("\n");
  useEffect(() => { setSlide(0); if (images.length < 2) return; const timer = window.setInterval(() => setSlide(index => (index + 1) % images.length), 5000); return () => window.clearInterval(timer); }, [imageKey, images.length]);
  return <article className={styles.card}>
    <div className={styles.layout} data-has-image={Boolean(images.length)} data-image-side={imageSide ?? marketing.imageSide ?? "left"}>
      <header className={styles.title}>{marketing.category && <p className={styles.category}>{marketing.category}</p>}<h2>{course.name || "講座名"}</h2>{course.subtitle && <p>{course.subtitle}</p>}</header>
      {images.length > 0 && <div className={styles.media}><img src={images[slide % images.length]} alt={`${course.name || "講座画像"}${images.length > 1 ? ` ${slide % images.length + 1}枚目` : ""}`} />{images.length > 1 && <nav className={styles.dots} aria-label="講座画像">{images.map((url, index) => <button key={`${url}:${index}`} type="button" aria-label={`${index + 1}枚目の画像`} aria-pressed={slide % images.length === index} onClick={() => setSlide(index)}>●</button>)}</nav>}</div>}
      <div className={styles.body}>
        {course.description && <p>{course.description}</p>}
        {course.can_do_after && <section><h3>受講後にできること</h3><p>{course.can_do_after}</p></section>}
        {curriculum.length > 0 && <section><h3>カリキュラム</h3><ol>{curriculum.map((item, index) => <li key={index}>{item}</li>)}</ol></section>}
        {course.duration_text && <p><strong>所要時間</strong>　{course.duration_text}</p>}
        {course.kit_contents && <section><h3>教材・キット</h3><p>{course.kit_contents}</p></section>}
        {course.material_contents && <section><h3>教材の案内</h3><p>{course.material_contents}</p></section>}
        {course.certification_conditions && <section><h3>認定条件</h3><p>{course.certification_conditions}</p></section>}
        {!hidePrice && <div className={styles.price}><p>{priceLabel}</p><strong>{Number.isFinite(course.price) ? `¥${course.price.toLocaleString("ja-JP")}` : "価格未入力"}</strong></div>}
      </div>
    </div>
  </article>;
}
