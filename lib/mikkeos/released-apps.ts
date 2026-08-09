import { BookOpenText, CalendarDays, Users } from "lucide-react";
import type { MikkeOwnerMenuItem } from "@/components/mikkeos/MikkeOwnerMenu";

export const marketNoteApp: MikkeOwnerMenuItem = { title: "MarketNote", href: "/marketnote", icon: CalendarDays, tone: "orange" };
export const storyApp: MikkeOwnerMenuItem = { title: "Story", href: "/story", icon: BookOpenText, tone: "blue" };
export const communityApp: MikkeOwnerMenuItem = { title: "Community", href: "/community", icon: Users, tone: "yellow" };

/** Public release catalog. Do not use this list as proof that a user owns every app. */
export const releasedApps: MikkeOwnerMenuItem[] = [marketNoteApp, storyApp, communityApp];
