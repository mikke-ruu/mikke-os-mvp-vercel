import { resolve4 } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export function isPublicIPv4(address: string) {
  if (isIP(address) !== 4) return false;
  const [a,b] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,168].includes(b)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18,19,51].includes(b)) || (a === 203 && b === 0));
}

export function publicWebUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || isIP(url.hostname) || !url.hostname.includes(".") || /\.(localhost|local|internal|test|invalid)$/.test(url.hostname)) throw Error("URLを確認してください。");
  url.hash = "";
  return url;
}

async function readHtml(url: URL): Promise<{ html: string; redirect?: string }> {
  const addresses = await Promise.race([resolve4(url.hostname), new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(Error("名前解決に時間がかかっています。")),3000);timer.unref();})]);
  if (!addresses.length || !addresses.every(isPublicIPv4)) throw Error("このURLは取得できません。");
  return new Promise((resolve,reject) => {
    // Pin the socket to the validated address; a second DNS lookup cannot rebind it.
    const req = request(url, { method:"GET", lookup: (_host, options, callback) => { if (options.all) { const allCallback = callback as unknown as (error: Error | null, values: {address:string;family:number}[]) => void; allCallback(null, [{address:addresses[0],family:4}]); } else callback(null, addresses[0], 4); }, headers:{Accept:"text/html", "Accept-Encoding":"identity", "User-Agent":"MikkeMediaLinkPreview/1.0"} }, response => {
      const status = response.statusCode ?? 0;
      if ([301,302,303,307,308].includes(status) && response.headers.location) {response.resume();resolve({html:"",redirect:response.headers.location});return;}
      if (status !== 200 || !String(response.headers["content-type"]).includes("text/html")) {response.resume();reject(Error("リンク先からカード情報を取得できませんでした。"));return;}
      const chunks: Buffer[] = []; let size=0;
      response.on("data", (chunk: Buffer) => {size+=chunk.length;if(size>512*1024){req.destroy(Error("ページが大きいため取得できませんでした。"));return;}chunks.push(chunk);});
      response.on("end",()=>resolve({html:Buffer.concat(chunks).toString("utf8")}));
      response.on("error",reject);
    });
    const deadline=setTimeout(()=>req.destroy(Error("リンク先の応答に時間がかかっています。")),5000);
    req.on("close",()=>clearTimeout(deadline));req.on("error",reject);req.end();
  });
}

function decode(value: string) {return value.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,code)=>Number(code)<=0x10ffff?String.fromCodePoint(Number(code)):"").trim();}
export function parseLinkPreview(html: string, base: string) {
  const meta = new Map<string,string>();
  for (const tag of html.matchAll(/<meta\s[^>]*>/gi)) {
    const attrs = new Map<string,string>();
    for (const attr of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs.set(attr[1].toLowerCase(),decode(attr[2]??attr[3]??attr[4]??""));
    const key=attrs.get("property")??attrs.get("name");if(key&&attrs.get("content"))meta.set(key.toLowerCase(),attrs.get("content")!);
  }
  const title=(meta.get("og:title")??decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]??"")).slice(0,160);
  const description=(meta.get("og:description")??meta.get("description")??"").slice(0,300);
  let imageUrl="";try {const image=publicWebUrl(new URL(meta.get("og:image")??"",base).href);if(meta.has("og:image"))imageUrl=image.href;} catch {}
  return {title,description,imageUrl};
}
export async function getLinkPreview(value: string) {
  let url = publicWebUrl(value);
  for(let hop=0;hop<4;hop++) {const response=await readHtml(url);if(response.redirect){url=publicWebUrl(new URL(response.redirect,url).href);continue;}return parseLinkPreview(response.html,url.href);}
  throw Error("転送が多いため取得できませんでした。");
}
