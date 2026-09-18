"use client";
import type { ComponentProps } from "react";
import { MikkeMediaPicker } from "@/components/media/MikkeMediaPicker";
import { MediaPrivateImagePicker } from "./MediaPrivateImagePicker";
import { useMediaRepository } from "./MediaRepository";
import { useAuth } from "@/components/AuthGate";
type Props=Omit<ComponentProps<typeof MikkeMediaPicker>,"onSelect">&{onSelect:(asset:{id:string;publicUrl:string;originalName:string})=>void};
export function MediaImagePicker(props:Props){
  const {cloud}=useMediaRepository();
  const {user}=useAuth();
  return cloud?<MediaPrivateImagePicker key={user.id} currentUrl={props.currentUrl} cover={props.sourceApp==="media-cover"} onSelect={props.onSelect}/>:<MikkeMediaPicker key={user.id} {...props}/>;
}
