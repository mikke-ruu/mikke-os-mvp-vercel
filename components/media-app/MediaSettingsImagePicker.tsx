"use client";
import {MediaPrivateImagePicker} from "./MediaPrivateImagePicker";
import {MediaLocalImagePicker} from "./MediaLocalImagePicker";
import {useMediaRepository} from "./MediaRepository";
export function MediaSettingsImagePicker(props:{compact?:boolean;onSelect:(asset:{publicUrl:string})=>void;onRemove?:()=>void;removeLabel?:string}) {
 const {cloud}=useMediaRepository();
 return cloud?<div className="flex flex-wrap items-center gap-2"><MediaPrivateImagePicker onSelect={props.onSelect}/>{props.onRemove?<button type="button" onClick={props.onRemove} className="text-xs underline">{props.removeLabel??"画像を外す"}</button>:null}</div>:<MediaLocalImagePicker {...props}/>;
}
