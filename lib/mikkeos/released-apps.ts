import { BookOpenText, CalendarDays, GraduationCap, Users } from "lucide-react";
import type { MikkeOwnerMenuItem } from "@/components/mikkeos/MikkeOwnerMenu";
import { MIKKE_MENU_APP_KEYS, type MikkeMenuAppKey } from "./menu-preferences-model";

export type MikkeMenuAppDefinition = MikkeOwnerMenuItem & { appKey: MikkeMenuAppKey };

export const marketNoteApp: MikkeMenuAppDefinition = { appKey: "marketnote", title: "MarketNote", href: "/marketnote", icon: CalendarDays, tone: "orange" };
export const storyApp: MikkeMenuAppDefinition = { appKey: "story", title: "Story", href: "/story", icon: BookOpenText, tone: "blue" };
export const communityApp: MikkeMenuAppDefinition = { appKey: "community", title: "Community", href: "/community", icon: Users, tone: "yellow" };

/**
 * 認定講座サイト管理は一般公開アプリではない。
 * mikke_app_entitlements で付与された所有者にだけメニューに出るため releasedApps には含めない。
 */
export const ninteiKozaApp: MikkeMenuAppDefinition = {
  appKey: "ninteikoza",
  title: "認定講座サイト管理",
  href: "/nintei-koza-admin",
  icon: GraduationCap,
  tone: "pink"
};

/** DB/RPCのapp_keyはこのregistryだけを正典にする。apps.tsのmarket_note等はActivity Log用で別契約。 */
export const mikkeMenuAppRegistry: Record<MikkeMenuAppKey, MikkeMenuAppDefinition> = {
  marketnote: marketNoteApp,
  story: storyApp,
  community: communityApp,
  ninteikoza: ninteiKozaApp
};

export const mikkeMenuAppOrder = MIKKE_MENU_APP_KEYS;

/** Public release catalog. Do not use this list as proof that a user owns every app. */
export const releasedApps: MikkeMenuAppDefinition[] = [marketNoteApp, storyApp, communityApp];
