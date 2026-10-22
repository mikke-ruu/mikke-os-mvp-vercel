import type { ReactNode } from 'react';
import type { LpBlock } from '@/components/mikkeos/page-builder/lp-design';
import type { SalesPageDisplay } from '@/lib/academy2/sales-page-display';
import styles from './sales-page-presentation.module.css';

/** Presentation only. Callers retain the authoritative price, public event projection and intake. */
export function SalesPresentation({ display, children }: { display: SalesPageDisplay; children: ReactNode }) {
  return <div className={styles.bottom} data-spacing={display.spacing} data-tone={display.tone}>{children}</div>;
}
export function SalesPresentationSection({ id, heading, align = 'center', children }: { id?: string; heading: string; align?: 'left'|'center'; children: ReactNode }) {
  return <section id={id} className={styles.section}><div className={styles.inner}><h2 style={{textAlign:align}}>{heading}</h2>{children}</div></section>;
}
export type SalesPresentationEvent = { id: string; title: string; startsAt: string|null; scheduleMode: string; format: string; capacity?: number|null };
export function SalesPresentationEvents({ events }: { events: SalesPresentationEvent[] }) {
  return <div className={styles.events}>{events.map(event => <article key={event.id} className={styles.event}><h3>{event.title}</h3><p>{event.scheduleMode === 'arranged_after_application' ? '申込後に日程を相談' : event.startsAt ? new Date(event.startsAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}) : '日程未定'}</p><p>{event.format === 'online' ? 'オンライン' : '対面'}{event.capacity == null ? '' : ` ・ 定員 ${event.capacity}名`}</p></article>)}</div>;
}

/** Keep the plan title visible on older custom pages without overwriting their blocks. */
export function salesPageHasVisibleTitle(blocks: LpBlock[], title: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
  const expected = normalize(title);
  if (!expected) return false;
  return blocks.some(block => block.lp?.hidden !== true && (
    block.type === 'heading' && normalize(block.text ?? '') === expected
    || salesPageHasVisibleTitle(block.lp?.children ?? [], title)
  ));
}
