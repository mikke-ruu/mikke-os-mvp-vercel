import { BookOpenText, CalendarDays, GraduationCap, Users } from "lucide-react";
import type { MikkeOwnerMenuItem } from "@/components/mikkeos/MikkeOwnerMenu";

export const marketNoteApp: MikkeOwnerMenuItem = { title: "MarketNote", href: "/marketnote", icon: CalendarDays, tone: "orange" };
export const storyApp: MikkeOwnerMenuItem = { title: "Story", href: "/story", icon: BookOpenText, tone: "blue" };
export const academyApp: MikkeOwnerMenuItem = { title: "Academy", href: "/academy", icon: GraduationCap, tone: "pink" };
export const communityApp: MikkeOwnerMenuItem = { title: "Community", href: "/community", icon: Users, tone: "yellow" };

/**
 * 認定講座サイト管理は一般公開アプリではない。
 * mikke_app_entitlements で付与された所有者にだけメニューに出るため releasedApps には含めない。
 */
export const ninteiKozaApp: MikkeOwnerMenuItem = {
  title: "認定講座サイト管理",
  href: "/nintei-koza-admin",
  icon: GraduationCap,
  tone: "pink"
};

/** Public release catalog. Do not use this list as proof that a user owns every app. */
export const releasedApps: MikkeOwnerMenuItem[] = [marketNoteApp, storyApp, academyApp, communityApp];
