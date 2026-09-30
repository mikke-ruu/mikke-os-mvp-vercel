import type { AcademyPageBlock } from '@/types/database';
import { writeLessons } from '@/lib/academy/lesson-content';

export type DemoCourse = {
  id: string; name: string; description: string; subtitle: string; targetAudience: string;
  duration: string; referencePrice: string; blocks: AcademyPageBlock[]; updatedAt: string;
};
export type DemoPlan = {
  id: string; title: string; kind: string; courseIds: string[]; studyStyle: string;
  methods: string[]; price: string; payment: string; after: string[];
  formQuestion: string; pageIntro: string; updatedAt: string;
};
export type DemoData = { courses: DemoCourse[]; plans: DemoPlan[] };
const key = 'academy2_public_demo_v1';

const seed: DemoData = {
  courses: [{
    id: 'demo-accessory', name: 'はじめてのアクセサリー作り',
    description: '道具の使い方から学び、ビーズのイヤリングを一組作ります。',
    subtitle: '自分らしい一組を作る、はじめてのレッスン',
    targetAudience: 'アクセサリー作りが初めての方', duration: '約2時間',
    referencePrice: '5000', updatedAt: '2026-09-30T00:00:00.000Z',
    blocks: writeLessons([{ id: 'demo-lesson-1', title: '道具とパーツをそろえる', blocks: [] }, { id: 'demo-lesson-2', title: 'イヤリングを組み立てる', blocks: [] }]),
  }],
  plans: [{
    id: 'demo-plan-1', title: 'アクセサリー体験プラン', kind: 'ワークショップ',
    courseIds: ['demo-accessory'], studyStyle: '講師と学ぶ', methods: ['対面'], price: '5500',
    payment: '銀行振込', after: ['修了記録'], formQuestion: '作ってみたい色を教えてください',
    pageIntro: '初めての方も、道具の使い方から一緒に始めましょう。', updatedAt: '2026-09-30T00:00:00.000Z',
  }],
};

export function loadDemo(): DemoData {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(seed);
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && Array.isArray((value as DemoData).courses) && Array.isArray((value as DemoData).plans)) return value as DemoData;
  } catch { /* Reset malformed or unavailable browser-only data to examples. */ }
  return structuredClone(seed);
}
export function persistDemo(value: DemoData): void { localStorage.setItem(key, JSON.stringify(value)); }
export function demoHref(view: string, id?: string, extra?: string): string {
  const query = new URLSearchParams({ view });
  if (id) query.set('id', id);
  if (extra) query.set('sample', extra);
  return `/academy/demo?${query}`;
}
