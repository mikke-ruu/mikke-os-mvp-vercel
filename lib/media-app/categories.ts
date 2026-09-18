export function articleCategories(value?:{category?:string;categories?:string[]}|null):string[]{return [...new Set((value?.categories??[value?.category??" "]).map(c=>c.trim()).filter(Boolean))];}
