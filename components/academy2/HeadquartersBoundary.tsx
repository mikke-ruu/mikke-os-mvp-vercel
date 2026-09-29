"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, CalendarDays, ClipboardList, Globe, GraduationCap, LayoutDashboard, Megaphone, Settings, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthGate';
import { HeadquartersShell } from './HeadquartersShell';
import { parseAcademyContextPath, toAcademyContextHref } from '@/lib/academy/access-context';
import { listAcademy2Headquarters, type Academy2HeadquartersContext } from '@/lib/academy2/context';
import { canAcademy2, type Academy2Action } from '@/lib/academy2/permissions.mjs';
import { headquartersEntryTarget } from '@/lib/academy2/entry-routing.mjs';
import { supabase } from '@/lib/supabase/client';

const HeadquartersContext = createContext<Academy2HeadquartersContext | null>(null);
export const useAcademy2Headquarters = () => useContext(HeadquartersContext);
const sections: { href: string; label: string; icon: typeof BookOpen; action: Academy2Action }[] = [
  { href: '/academy/courses', label: '講座', icon: BookOpen, action: 'courses.edit' },
  { href: '/academy/offerings', label: '販売プラン', icon: Megaphone, action: 'public_price.edit' },
  { href: '/academy/classes', label: '開催', icon: CalendarDays, action: 'applications.operate' },
  { href: '/academy/offering-applications', label: '申込', icon: ClipboardList, action: 'applications.read' },
  { href: '/academy/certifications', label: '認定', icon: GraduationCap, action: 'applications.read' },
  { href: '/academy/instructors', label: '講師', icon: Users, action: 'leave.review' },
  { href: '/academy/front', label: 'ページ', icon: Globe, action: 'pages.edit' },
  { href: '/academy/settings', label: '設定', icon: Settings, action: 'connect.manage' },
];

/** Opt-in only. Legacy content is mounted only after the new membership lookup completes. */
export function HeadquartersBoundary({ children, legacy }: { title: string; children: React.ReactNode; legacy: React.ReactNode }) {
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const query = useSearchParams();
  const router = useRouter();
  const route = parseAcademyContextPath(pathname);
  const id = route?.portal === 'manage' ? route.academyId : null;
  const [resolved, setResolved] = useState<{ identity: string; hq: Academy2HeadquartersContext | null } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const identity = `${user.id}:${id}`;
  useEffect(() => {
    let current = true;
    setResolved(null); setError('');
    listAcademy2Headquarters().then(rows => {
      if (!current) return;
      if (!id && rows.length) {
        const target = headquartersEntryTarget(pathname, rows.map(row => row.id), window.location.search);
        if (target) router.replace(target);
        return;
      }
      setResolved({ identity, hq: rows.find(row => row.id === id) ?? null });
    })
      .catch(cause => { if (current) setError(cause instanceof Error ? cause.message : '権限を確認できませんでした。'); });
    return () => { current = false; };
  }, [identity, id, pathname, router, retry]);
  if (error) return <div role="alert" className="p-5 text-sm"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>再読み込み</button></div>;
  if (!resolved || resolved.identity !== identity) return <p role="status" className="py-10 text-center text-sm">権限を確認中…</p>;
  if (!resolved.hq) return legacy;
  const hq = resolved.hq;
  const href = (value: string) => toAcademyContextHref(value, hq.id, 'manage');
  const allowed = sections.filter(item => canAcademy2(hq.role, item.action, { sameHeadquarters: true })
    || (item.href === '/academy/settings' && canAcademy2(hq.role, 'notifications.manage', { sameHeadquarters: true })));
  const nav = [{ href: href('/academy'), label: 'ホーム', icon: LayoutDashboard }, ...allowed.map(item => ({ ...item, href: href(item.href) }))];
  const canonical = pathname.replace(/^\/academy\/h\/[^/]+\/manage/, '/academy');
  const sectionPath = /^\/academy\/(?:applications|kits)(?:\/|$)/.test(canonical)
    ? query.get('from') === 'certifications' ? '/academy/certifications' : '/academy/offering-applications'
    : canonical;
  const section = sections.find(item => sectionPath === item.href || sectionPath.startsWith(item.href + '/'));
  const denied = !!section && !allowed.includes(section);
  // Do not mount a legacy page with its old role/side effects under a new role.
  // Expand this allowlist only after that page's read and write adapters are connected.
  const connected = canonical === '/academy' || canonical === '/academy/'
    || /^\/academy\/courses(?:\/(?:new|[0-9a-f-]{36}))?\/?$/i.test(canonical)
    || /^\/academy\/courses\/[0-9a-f-]{36}\/lessons\/[^/]+\/edit\/?$/i.test(canonical)
    || (/^\/academy\/courses\/[0-9a-f-]{36}\/instructor-page\/?$/i.test(canonical) && query.get('audience') === 'learner')
    || /^\/academy\/instructors(?:\/[0-9a-f-]{36})?\/?$/i.test(canonical)
    || /^\/academy\/certifications\/?$/.test(canonical)
    || /^\/academy\/(?:offerings|classes)\/(?:new|[0-9a-f-]{36})\/?$/i.test(canonical)
    || /^\/academy\/(?:offerings|classes|settings|offering-applications|kits)\/?$/.test(canonical)
    || /^\/academy\/applications(?:\/[0-9a-f-]{36})?\/?$/i.test(canonical);
  async function signOut() {
    const { error: failure } = await supabase.auth.signOut();
    if (failure) { setError('ログアウトできませんでした。もう一度お試しください。'); return; }
    window.location.assign('/login');
  }
  const createLinks = [
    {path:'/academy/courses/new',label:'講座をつくる',action:'courses.edit'},
    {path:'/academy/offerings/new',label:'販売をつくる',action:'public_price.edit'},
    {path:'/academy/classes/new',label:'開催日追加',action:'applications.operate'},
  ].filter(item=>canAcademy2(hq.role,item.action as Academy2Action,{sameHeadquarters:true})).map(item=>({href:href(item.path),label:item.label}));
  return <HeadquartersContext.Provider value={hq}><HeadquartersShell name={hq.name} role={hq.role} mikkeId={profile.handle} nav={nav} activeHref={section?href(section.href):href('/academy')} createLinks={createLinks} onSignOut={()=>void signOut()}>
    {denied ? <p role="alert" className="p-5">この画面を操作する権限がありません。</p> : connected ? children : <p role="status" className="p-5">この画面は準備中です。</p>}
  </HeadquartersShell></HeadquartersContext.Provider>;
}
