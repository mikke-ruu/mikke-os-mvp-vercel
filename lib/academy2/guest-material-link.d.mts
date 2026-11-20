export function guestMaterialPath(id:string,token?:string):string;
export function appendGuestMaterialAccess<T extends {text:string;html:string}>(message:T,id:string,enabled:boolean,origin:string,token?:string):T;
