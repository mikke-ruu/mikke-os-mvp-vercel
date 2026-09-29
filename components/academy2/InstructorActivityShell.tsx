"use client";

import { useEffect, useState } from 'react';
import { GraduationCap, Settings } from 'lucide-react';
import { AuthGate, useAuth } from '@/components/AuthGate';
import { MikkeAppShell } from '@/components/mikkeos/MikkeAppShell';
import surface from '@/components/academy/academy-surface.module.css';
import { loadInstructorActivityContext, type InstructorActivityContext } from '@/lib/academy2/context';
import { supabase } from '@/lib/supabase/client';

function ActivityShellInner({ activityId, children }: { activityId: string; children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const [context, setContext] = useState<InstructorActivityContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) { setError('ログアウトできませんでした。もう一度お試しください。'); return; }
    window.location.assign('/login');
  }
  useEffect(() => {
    let current = true;
    setContext(null);
    setError(null);
    if (!userId) return;
    void loadInstructorActivityContext(activityId).then(value => {
      if (current) setContext(value);
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : '活動・契約を読み込めませんでした。');
    });
    return () => { current = false; };
  }, [activityId, userId, retry]);

  if (error) return <main className="mx-auto max-w-lg px-4 py-16"><div role="alert" className="text-sm"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 rounded-[9px] border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs">もう一度読み込む</button></div></main>;
  if (!context || !user || !profile || profile.user_id !== user.id) return <p role="status" className="py-16 text-center text-sm text-[var(--mikke-muted)]">権限を確認中…</p>;
  const href = `/academy/instructor-settings/activity/${activityId}`;
  // Authenticated-save verification connection only. The full approved instructor
  // settings navigation (A-F) remains a separate integration; do not treat this
  // deliberately limited route as its visual replacement.
  const navItems = [{ href, label: '活動・契約', icon: Settings }];
  return <MikkeAppShell contentWidth="standard" appName="Academy" title="Academy" subtitle="講師設定" theme="blue"
    currentApp={{ label: 'Academy', href, icon: GraduationCap }}
    menuEditItems={navItems.map(item => ({ title: item.label, href: item.href, icon: item.icon }))}
    ownedApps={[]} otherApps={[]} suggestedApps={[]} mikkeId={profile.handle} onSignOut={() => void signOut()}
    navItems={navItems} bottomNavItems={navItems} showBottomNavLabels simpleMenu showSharedUtilities={false} footerLabel="Academy by mikke">
    <div className={surface.page}>
      <details className={surface.utility}><summary>教室・アカウントの案内</summary><div className="py-3 text-xs text-[var(--mikke-muted)]">{context.name} / 講師設定</div></details>
      <div className={surface.content}>{children}</div>
    </div>
  </MikkeAppShell>;
}

export function InstructorActivityShell({ activityId, children }: { activityId: string; children: React.ReactNode }) {
  return <AuthGate><ActivityShellIdentity activityId={activityId}>{children}</ActivityShellIdentity></AuthGate>;
}

function ActivityShellIdentity({ activityId, children }: { activityId: string; children: React.ReactNode }) {
  const { user } = useAuth();
  return <ActivityShellInner key={`${user?.id ?? 'signed-out'}:${activityId}`} activityId={activityId}>{children}</ActivityShellInner>;
}
