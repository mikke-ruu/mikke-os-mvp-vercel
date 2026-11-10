"use client";
import { useState, type ComponentType } from "react";
import { AcademyImageUploader } from "./AcademyImageUploader";
import compactStyles from './course-image-grid.module.css';
import styles from "./academy-course-input.module.css";
export function AcademyCourseImages({ images, onChange, maxImages = 6, ImagePicker=AcademyImageUploader, note, compact=false, disabled=false }: { images: string[]; onChange: (images: string[]) => void; maxImages?: number; ImagePicker?:ComponentType<{compact?:boolean;currentUrl?:string;onUploaded:(url:string)=>void}>; note?:string;compact?:boolean;disabled?:boolean }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [notice,setNotice]=useState('');
  function move(from: number, to: number) { if (to < 0 || to >= images.length) return; const next = [...images]; [next[from], next[to]] = [next[to], next[from]]; onChange(next); setEditing(null); }
  if(compact)return <fieldset disabled={disabled} className={compactStyles.root}>
    <p className={compactStyles.count}>写真 {images.length} / {maxImages}枚</p>
    <div className={compactStyles.grid}>
      {images.map((url,index)=><div className={compactStyles.tile} key={index+':'+url}>
        <button type="button" className={compactStyles.photo} aria-label={'写真'+(index+1)+'を変更'} onClick={()=>setEditing(editing===index?null:index)}><img src={url} alt={'講座画像 '+(index+1)}/><span className={compactStyles.badge}>{index===0?'代表画像':(index+1)+'枚目'}</span></button>
        <div className={compactStyles.tools}>
          <button type="button" aria-label={'写真'+(index+1)+'を前へ'} disabled={index===0} onClick={()=>move(index,index-1)}>←</button>
          <button type="button" aria-label={'写真'+(index+1)+'を次へ'} disabled={index===images.length-1} onClick={()=>move(index,index+1)}>→</button>
          <button type="button" aria-label={'写真'+(index+1)+'を削除'} onClick={()=>{onChange(images.filter((_,i)=>i!==index));setEditing(null);}}>×</button>
        </div>
      </div>)}
      {images.length<maxImages&&<button type="button" className={compactStyles.add} onClick={()=>setEditing(editing==='new'?null:'new')} aria-label="写真を追加"><span aria-hidden="true">＋</span>写真を追加</button>}
    </div>
    {editing!==null&&<div className={compactStyles.picker}><header><span>{editing==='new'?'写真を追加':'写真を変更'}</span><button type="button" onClick={()=>setEditing(null)}>閉じる</button></header><ImagePicker compact onUploaded={url=>{if(images.some((image,i)=>i!==editing&&image===url)){setNotice('この写真は登録済みです。別の写真を選んでください。');return;}if(editing==='new'){if(images.length>=maxImages)return;onChange([...images,url]);}else onChange(images.map((image,i)=>i===editing?url:image));setNotice('');setEditing(null);}}/></div>}
    {notice&&<p role="status" className={compactStyles.error}>{notice}</p>}
    <small className={compactStyles.note}>{note??'1枚目が代表画像です。写真を押すと変更できます。'}</small>
  </fieldset>;
  return <div className={styles.images}>{images.map((url, index) => <div className={styles.imageRow} key={`${index}:${url}`}><img src={url} alt={`講座画像 ${index + 1}`} /><div className={styles.imageActions}><small>{index === 0 ? "1枚目・代表画像" : `${index + 1}枚目`}</small><button className={styles.plainButton} type="button" onClick={() => setEditing(editing === index ? null : index)}>画像変更</button><button className={styles.plainButton} type="button" onClick={() => { onChange(images.filter((_, i) => i !== index)); setEditing(null); }}>画像削除</button><button className={styles.plainButton} type="button" disabled={!index} aria-label={`画像${index + 1}を前へ`} onClick={() => move(index, index - 1)}>←</button><button className={styles.plainButton} type="button" disabled={index === images.length - 1} aria-label={`画像${index + 1}を次へ`} onClick={() => move(index, index + 1)}>→</button></div>{editing === index && <div className={styles.picker}><ImagePicker compact onUploaded={next => { onChange(images.map((image, i) => i === index ? next : image)); setEditing(null); }} /></div>}</div>)}{images.length < maxImages && <button className={styles.plainButton} type="button" onClick={() => setEditing(editing === "new" ? null : "new")}>＋ 画像を追加</button>}{editing === "new" && images.length < maxImages && <div className={styles.picker}><ImagePicker compact onUploaded={url => { onChange([...images, url]); setEditing(null); }} /></div>}<small className={styles.note}>{note ?? (maxImages === 1 ? "講座の代表画像画像です。" : "写真は6枚まで登録できます。1枚目は代表画像になります。")}</small></div>;
}
