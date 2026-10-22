import type {SalesPlanDraftConfiguration} from './sales-plan-drafts';

/** An internal content identifier; published revisions and consent snapshots stay immutable. */
export async function commonTermsForSave(terms:SalesPlanDraftConfiguration['terms'], previous?:SalesPlanDraftConfiguration['terms']) {
  const body=terms?.body??'';
  if(!body.trim())return {...terms,body,version:terms?.version??''};
  if(previous?.body===body&&previous.version)return {body,version:previous.version};
  // Preserve an explicitly supplied historical identifier on first import.
  if(!previous&&terms?.version)return {body,version:terms.version};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  return {body,version:'auto-sha256-'+hash};
}
