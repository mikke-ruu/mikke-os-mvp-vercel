/** Explicit local-review alias only; never broadens the HTTPS-only database contract. */
export function reviewStorageUrl(value,localOrigin,canonicalOrigin){
 if(!value||!canonicalOrigin||!localOrigin)return value;
 const local=new URL(localOrigin),image=new URL(value,localOrigin);
 if(local.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(local.hostname)||image.origin!==local.origin||!image.pathname.startsWith('/storage/v1/object/public/mikke-media/'))return value;
 const canonical=new URL(canonicalOrigin);
 if(canonical.protocol!=='https:'||canonical.username||canonical.password||canonical.pathname!=='/'||canonical.search||canonical.hash)throw Error('ローカル確認用の画像接続設定を確認してください。');
 return canonical.origin+image.pathname+image.search;
}
