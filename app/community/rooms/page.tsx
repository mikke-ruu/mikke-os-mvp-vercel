import { redirect } from "next/navigation";
import { communityBasePath, FIRST_COMMUNITY_SLUG } from "@/lib/community/routes";

export default function CommunityRoomsPage() {
  redirect(`${communityBasePath(FIRST_COMMUNITY_SLUG)}/rooms`);
}
