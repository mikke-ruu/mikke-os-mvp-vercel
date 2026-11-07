"use client";
import Link from 'next/link';
import {MikkeAppShell} from '@/components/mikkeos/MikkeAppShell';
import {TeamWorksRoleSwitcher} from '@/components/team-works/TeamWorksRoleSwitcher';
import {AuthGate} from '@/components/AuthGate';
import {TeamWorksPartnerHistory} from '@/components/team-works/operations/TeamWorksPartnerHistory';
export default function Page(){return <AuthGate><MikkeAppShell appName="Team Works" title="自分の実施履歴・報酬" theme="green" ownedApps={[]} otherApps={[]} suggestedApps={[]}><TeamWorksRoleSwitcher current="worker"/><div className="mx-auto max-w-4xl space-y-5"><Link href="/apps/team-works/portal/worker" aria-label="パートナーポータルに戻る">← パートナーポータル</Link><h1 className="text-xl font-bold">自分の実施履歴・報酬</h1><TeamWorksPartnerHistory/></div></MikkeAppShell></AuthGate>;}
