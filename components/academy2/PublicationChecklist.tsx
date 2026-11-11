import type {ReactNode} from 'react';
import styles from './publication-flow.module.css';
export type PublicationTask={key:string;label:string;href?:string;actionLabel?:string};
export function PublicationChecklist({tasks,children}:{tasks:PublicationTask[];children?:ReactNode}){
 return <div className={styles.checklist}>{tasks.length>0?<><h3>公開前に設定すること</h3><ul className={styles.list}>{tasks.map(task=><li key={task.key}><span className={styles.taskText}>{task.label}</span>{task.href&&<a className={styles.button} href={task.href}>{task.actionLabel||'設定する'}</a>}</li>)}</ul></>:<p>ページを公開する準備が整いました。</p>}{children}</div>;
}
