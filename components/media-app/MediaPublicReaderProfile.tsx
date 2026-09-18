"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase/client';
import type {ReaderProfile} from '@/lib/media-app/social-cloud';
import {MediaReaderAvatar} from './MediaCloudSocial';
import styles from './MediaCloudSocial.module.css';
export function MediaPublicReaderProfile({id}:{id:string}){
 const [profile,setProfile]=useState<ReaderProfile|null>(null),[ready,setReady]=useState(false);
 useEffect(()=>{let live=true;void supabase.rpc('media_reader_profile',{p_id:id}).then(({data})=>{if(live){setProfile(data);setReady(true);}});return()=>{live=false;};},[id]);
 return <main className="mx-auto max-w-xl px-5 py-8"><h1 className="text-xl font-bold">プロフィール</h1><section className={styles.panel}>{profile?<><div className={styles.actions}><MediaReaderAvatar profile={profile}/><strong>{profile.name}</strong></div><p className={styles.body}>{profile.bio}</p>{profile.href&&!profile.href.startsWith('/media-reader/')?<Link href={profile.href}>Mediaを読む →</Link>:null}</>:<p>{ready?'プロフィールは公開されていません。':'読み込んでいます…'}</p>}</section><Link href="/apps/media/my">My Media</Link></main>;
}
