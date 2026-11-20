export function participationMail(payload:Record<string,any>,links:Record<string,any>):{subject:string;body:string};
export function deliverParticipationMail(client:any,jobId:string,deliver:any,makeLinks:any):Promise<string>;
