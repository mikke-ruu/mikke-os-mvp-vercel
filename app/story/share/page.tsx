import { redirect } from "next/navigation";

export default function StoryShareRoute() {
  redirect("/share?from=story");
}
