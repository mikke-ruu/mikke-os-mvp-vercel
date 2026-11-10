import type {ReactNode} from 'react';
import styles from './editor-page-region.module.css';
export function FixedPageRegion({title,children,onEdit,note='自動表示'}:{title:string;children:ReactNode;onEdit?:()=>void;note?:string}){
 return <section className={styles.fixed} data-editor-region="fixed" aria-label={title+'（'+note+'）'}><div className={styles.label}><span>{title}</span><small>{note}</small>{onEdit&&<button type="button" onClick={onEdit}>設定で変更</button>}</div><div contentEditable={false}>{children}</div></section>;
}
export function EditablePageRegion({children,onAdd,empty=false}:{children:ReactNode;onAdd:()=>void;empty?:boolean}){
 return <section className={styles.editable} data-editor-region="editable" aria-label="文章・画像を追加できる範囲"><div className={styles.label}><span>文章・画像を追加できる範囲</span><button type="button" onClick={onAdd}>＋ 内容を追加</button></div>{empty&&<p className={styles.empty}>ここに文章や画像を追加できます。</p>}{children}</section>;
}
