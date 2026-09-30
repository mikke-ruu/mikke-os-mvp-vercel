import { Suspense } from 'react';
import { AcademyDemo } from './AcademyDemo';

export const metadata = { title: 'Academy 2.0 デモ | mikkeOS', robots: { index: false, follow: false } };

export default function Page() {
  return <Suspense fallback={<p>デモを読み込んでいます…</p>}><AcademyDemo /></Suspense>;
}
