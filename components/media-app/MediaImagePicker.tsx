"use client";
import type { ComponentProps } from "react";
import { MikkeMediaPicker } from "@/components/media/MikkeMediaPicker";
import { MediaPrivateImagePicker } from "./MediaPrivateImagePicker";
import { useMediaRepository } from "./MediaRepository";
type Props=Omit<ComponentProps<typeof MikkeMediaPicker>,"onSelect">&{onSelect:(asset:{id:string;publicUrl:string;originalName:string})=>void};
export function MediaImagePicker(props:Props){
  const {cloud}=useMediaRepository();
  return cloud?<MediaPrivateImagePicker currentUrl={props.currentUrl} onSelect={props.onSelect}/>:<MikkeMediaPicker {...props}/>;
}
