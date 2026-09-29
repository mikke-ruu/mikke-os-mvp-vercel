"use client";
import { ClipboardList, GraduationCap, CheckCheck, CalendarDays } from 'lucide-react';
import { AuthGate, useAuth } from '@/components/AuthGate';
import { MikkeAppShell } from '@/components/mikkeos/MikkeAppShell';
import { supabase } from '@/lib/supabase/client';
function Shell({children}:{children:React.ReactNode}){
 const {user,profile}=useAuth();
 const href='/academy/instructor-applications';
 const navItems=[{href,label:'申込',icon:ClipboardList},{href:'/academy/instructor-requests',label:'本部からの依頼',icon:ClipboardList},{href:'/academy/instructor-events',label:'開催',icon:CalendarDays},{href:'/academy/instructor-completion',label:'修了・認定',icon:CheckCheck}];
 // Authentication only: each list/detail RPC authorizes the actual instructor.
 // Do not reuse the legacy is_certified gate or infer HQ ownership from a route.
 if(!user||profile.user_id!==user.id)return <p role="status">権限を確認中…</p>;
 return <MikkeAppShell contentWidth="standard" appName="Academy" title="Academy" subtitle="講師ページ" theme="blue" currentApp={{label:'Academy',href,icon:GraduationCap}} menuEditItems={navItems.map(item=>({title:item.label,href:item.href,icon:item.icon}))} ownedApps={[]} otherApps={[]} suggestedApps={[]} mikkeId={profile.handle} onSignOut={()=>void supabase.auth.signOut().then(({error})=>{if(!error)window.location.assign('/login');})} navItems={navItems} bottomNavItems={navItems} showBottomNavLabels simpleMenu showSharedUtilities={false} footerLabel="Academy by mikke"><div key={user.id}>{children}</div></MikkeAppShell>;
}
export function InstructorOperationsShell({children}:{children:React.ReactNode}){return <AuthGate><Shell>{children}</Shell></AuthGate>;}


