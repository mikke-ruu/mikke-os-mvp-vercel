'use client';
import {useEffect,useRef} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {toCurrentAcademyContextHref} from '@/lib/academy/access-context';
type MaterialNavigateEvent=Event&{navigationType:string;destination:{url:string;key:string;sameDocument:boolean}};
type MaterialNavigation=EventTarget&{traverseTo:(key:string)=>{finished:Promise<unknown>}};
/** Save through the page's existing permission-checked operation; never create history entries to trap Back. */
export function useMaterialLeaveGuard({dirty,busy,save}:{dirty:boolean;busy:boolean;save:()=>Promise<boolean>}){
 const router=useRouter(),pathname=usePathname();const latest=useRef({dirty,busy,save});latest.current={dirty,busy,save};
 useEffect(()=>{let live=true,moving=false,resumeKey:string|null=null;
  async function leave(move:()=>void){if(moving||latest.current.busy)return;moving=true;try{if(latest.current.dirty&&!await latest.current.save())return;if(live)move();}finally{moving=false;}}
  const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const target=event.target;if(!(target instanceof Element))return;const link=target.closest<HTMLAnchorElement>('a[href]');if(!link||link.closest('[contenteditable]')||link.target&&link.target!=='_self'||link.hasAttribute('download'))return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname===location.pathname&&url.search===location.search)return;if(!latest.current.dirty&&!latest.current.busy&&!moving)return;event.preventDefault();event.stopImmediatePropagation();void leave(()=>router.push(toCurrentAcademyContextHref(url.pathname+url.search+url.hash)));};
  document.addEventListener('click',click,true);
  const candidate=(window as Window&{navigation?:MaterialNavigation}).navigation;
  const navigation=typeof candidate?.traverseTo==='function'?candidate:undefined;
  const traverse=(raw:Event)=>{const event=raw as MaterialNavigateEvent;if(event.navigationType!=='traverse')return;if(resumeKey===event.destination.key){resumeKey=null;return;}if(!event.destination.sameDocument||!event.cancelable||new URL(event.destination.url).origin!==location.origin||!latest.current.dirty&&!latest.current.busy&&!moving)return;event.preventDefault();void leave(()=>{resumeKey=event.destination.key;navigation!.traverseTo(resumeKey).finished.catch(()=>{resumeKey=null;});});};
  navigation?.addEventListener('navigate',traverse);
  return()=>{live=false;document.removeEventListener('click',click,true);navigation?.removeEventListener('navigate',traverse);};
 },[pathname,router]);
}
