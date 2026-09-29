"use client";
import {useEffect,useState} from 'react';
import {useAuth} from '@/components/AuthGate';
import {InstructorOperationsShell} from '@/components/academy2/InstructorOperationsShell';
import {InstructorEventList} from '@/components/academy2/InstructorEventList';
import {listMyInstructorApplications,type InstructorApplicationSummary} from '@/lib/academy2/instructor-operations';
function List(){const {user}=useAuth();const [items,setItems]=useState<InstructorApplicationSummary[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);const [retry,setRetry]=useState(0);
 useEffect(()=>{let current=true;setLoading(true);setError(null);setItems([]);if(!user)return;void listMyInstructorApplications().then(value=>{if(current)setItems(value);}).catch(e=>{if(current)setError(e instanceof Error?e.message:'申込を読み込めませんでした。');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[user,retry]);
 if(loading)return <p role="status" className="p-6 text-sm">申込を読み込んでいます…</p>;if(error)return <div className="p-6 text-sm"><p role="alert">{error}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>もう一度読み込む</button></div>;return <InstructorEventList items={items}/>;
}
export default function Page(){return <InstructorOperationsShell><List/></InstructorOperationsShell>;}

