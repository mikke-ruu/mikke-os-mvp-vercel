export function mediaYoutubeId(value: string) {
  try { const url=new URL(value); if(url.protocol!=="https:" || url.username || url.password || url.port) return null;
    const host=url.hostname.toLowerCase();let id: string | null=null;
    if(host==="youtu.be") id=url.pathname.slice(1);
    else if(["youtube.com","www.youtube.com","m.youtube.com","www.youtube-nocookie.com"].includes(host)) id=url.pathname==="/watch"?url.searchParams.get("v"): /^\/(embed|shorts|live)\//.test(url.pathname)?url.pathname.split("/")[2]:null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;
  } catch {return null;}
}
