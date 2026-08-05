import { redirect } from "next/navigation";
import { communityBasePath, FIRST_COMMUNITY_SLUG } from "@/lib/community/routes";

export default function CommunityProfilePage() {
  redirect(`${communityBasePath(FIRST_COMMUNITY_SLUG)}/profile`);
}
