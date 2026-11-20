import type {ReactNode} from 'react';
import styles from './publication-flow.module.css';
export type PublicationTask={key:string;label:string;href?:string;actionLabel?:string};
export function PublicationChecklist({tasks,children}:{tasks:PublicationTask[];children?:ReactNode}){
 return <div>{tasks.length>0?<><h3>公開まで、あと{tasks.length}項目です</h3><ul className={styles.list}>{tasks.map(task=><li key={task.key}><span>{task.label}</span>{task.href&&<a className={styles.button} href={task.href}>{task.actionLabel||'確認する'}</a>}</li>)}</ul></>:<p>公開に必要な設定を確認できました。</p>}{children}</div>;
}
