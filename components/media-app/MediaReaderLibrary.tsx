"use client";
import {articleCategories} from "@/lib/media-app/categories";
import styles from "./MediaReaderLibrary.module.css";
import {MediaLocalSubscription} from "./MediaLocalSubscription";
import {listLibrary,type LibraryRecord} from "@/lib/mikkeos/content/local-library";
import type {MediaCollection} from "./MediaCollections";
import {useEffect,useState} from "react";
import type {MediaArticle,MediaSite} from "@/lib/media-app/types";
import {MediaLink} from "./MediaNavigation";
import {MediaImage} from "./MediaImage";
export function MediaReaderLibrary({site,articles}:{site:MediaSite;articles:MediaArticle[]}) {
  const [expanded,setExpanded]=useState(false);
  const [category,setCategory]=useState("");const [month,setMonth]=useState("");const [query,setQuery]=useState("");const [page,setPage]=useState(1);
  const scope=`media:${site.ownerProfileId}:${site.id}`;
  const [collections,setCollections]=useState<LibraryRecord<MediaCollection>[]>([]),[collection,setCollection]=useState("");
  useEffect(()=>{let active=true;void listLibrary<MediaCollection>(scope,"collection").then(items=>{if(active)setCollections(items);}).catch(()=>{});return()=>{active=false;};},[scope]);
  const chosen=collections.find(item=>item.id===collection);
  const ordered=chosen?chosen.value.articleIds.flatMap(id=>articles.filter(article=>article.id===id)):articles;
  const filtered=ordered.filter(item=>(!category||articleCategories(item.publishedSnapshot).includes(category))&&(!month||item.publishedSnapshot?.publishedAt.slice(0,7)===month)&&item.publishedSnapshot?.title.toLowerCase().includes(query.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/12));const current=Math.min(page,pages);
  return <div className={styles.root}>
    {site.bannerImageUrl?<div className={styles.banner} style={{"--banner-position":`${site.bannerPosition??50}%`} as React.CSSProperties}><MediaImage src={site.bannerImageUrl} alt={`${site.name}のカバー画像`} className={styles.bannerImage}/></div>:null}
    <div className={styles.layout}>
    <aside id="media-about" className={styles.about}>
      <div className={styles.identity}>{site.logoImageUrl?<MediaImage src={site.logoImageUrl} alt="" className={styles.logo}/>:<div className={styles.avatar} aria-hidden="true">{site.name.slice(0,1)}</div>}<div><h1>{site.name}</h1>{site.authorName!==site.name?<p className={styles.author}>{site.authorName}</p>:null}</div></div>
      {site.description?<div className={styles.intro}><p className={expanded?styles.fullIntro:styles.shortIntro}>{site.description}</p>{site.description.length>70||site.description.includes("\n")?<button type="button" onClick={()=>setExpanded(!expanded)}>{expanded?"閉じる":"もっと見る"}</button>:null}</div>:null}
      {site.authorBio?<details className={styles.bio}><summary>発信者について</summary><p>{site.authorBio}</p></details>:null}
    </aside>
    <section className={styles.articles} aria-label="記事一覧">
      <div className={styles.navigation}><h2>記事</h2><span>{filtered.length}件</span><details className={styles.filters}><summary>検索・絞り込み{query||category||month||collection?" ●":""}</summary><div className={styles.filterFields}>
      <label>キーワード<input aria-label="公開記事を検索" placeholder="記事を検索" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>
      <label>カテゴリー<select aria-label="公開記事のカテゴリー" value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}}><option value="">すべて</option>{Array.from(new Set(articles.flatMap(a=>articleCategories(a.publishedSnapshot)))).map(c=><option key={c}>{c}</option>)}</select></label>
      <label>月別<input aria-label="公開記事の月" type="month" value={month} onChange={e=>{setMonth(e.target.value);setPage(1);}}/></label>
      {collections.length?<label>特集<select aria-label="特集で絞り込み" value={collection} onChange={e=>{setCollection(e.target.value);setPage(1);}}><option value="">すべての特集</option>{collections.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:null}
      {query||category||month||collection?<button type="button" onClick={()=>{setQuery("");setCategory("");setMonth("");setCollection("");setPage(1);}}>条件をクリア</button>:null}</div></details></div>
      <div className={styles.grid}>{filtered.slice((current-1)*12,current*12).map(item=>{const article=item.publishedSnapshot!;return <MediaLink key={item.id} href={`/apps/media/reader?published=1&article=${item.id}`} className={`${styles.card} ${!article.coverImageUrl?styles.noImage:""}`}>
        {article.coverImageUrl?<MediaImage src={article.coverImageUrl} alt="" className={styles.thumbnail}/>:null}
        <div className={styles.cardText}>{item.pinned?<p className={styles.pinned}>上部固定</p>:null}<h3>{article.title}</h3><p className={styles.metadata}>{articleCategories(article).map(c=><span key={c}>{c}</span>)}<time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString("ja-JP")}</time></p></div>
      </MediaLink>;})}</div>
      {!filtered.length?<p className={styles.empty}>該当する記事はありません。</p>:null}
      {pages>1?<nav aria-label="公開記事のページ" className={styles.pagination}><button disabled={current===1} onClick={()=>setPage(current-1)}>前へ</button><span>{current} / {pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)}>次へ</button></nav>:null}
    </section>
    <details className={styles.notifications}><summary>更新通知</summary><MediaLocalSubscription scope={scope} articles={articles}/></details>
    </div></div>;
}
