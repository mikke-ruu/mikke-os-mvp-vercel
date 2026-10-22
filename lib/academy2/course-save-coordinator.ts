/** Each step is an independent transaction. */
export async function coordinateCourseSave<T>(steps: {name:string; run:()=>Promise<unknown>}[], result:()=>T) {
 const completed:string[]=[];
 for(const step of steps){try{await step.run();completed.push(step.name);}catch(error){return {ok:false as const,completed,failed:step.name,error};}}
 return {ok:true as const,completed,value:result()};
}
