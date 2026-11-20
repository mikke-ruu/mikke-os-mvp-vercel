'use client';
import {useState} from 'react';
import {BookOpen} from 'lucide-react';
import styles from './applications-operation.module.css';
export function ApplicationThumbnail({src}:{src?:string|null}){const[failedSrc,setFailedSrc]=useState<string|null>(null);return <span className={styles.applicationThumbnail}>{src&&failedSrc!==src?<img src={src} alt="" loading="lazy" onError={()=>setFailedSrc(src)}/>:<BookOpen aria-hidden="true" size={28}/>}</span>;}
