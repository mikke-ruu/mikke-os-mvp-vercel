"use client";
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {AuthGate} from '@/components/AuthGate';
import {TeamWorksOperationsShell} from '@/components/team-works/operations/TeamWorksOperationsShell';
import {TeamWorksPartnerHistory} from '@/components/team-works/operations/TeamWorksPartnerHistory';
export default function Page(){const {partnerId}=useParams<{partnerId:string}>();return <AuthGate><TeamWorksOperationsShell title="パートナーの実施履歴・時給"><Link href="/apps/team-works/partners" className="mb-4 inline-block" aria-label="パートナー管理に戻る">← パートナー管理</Link><TeamWorksPartnerHistory partnerId={partnerId}/></TeamWorksOperationsShell></AuthGate>;}
