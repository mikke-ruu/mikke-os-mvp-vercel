import { BookOpenText, CalendarDays, Users } from "lucide-react";
import type { MikkeOwnerMenuItem } from "@/components/mikkeos/MikkeOwnerMenu";

export const releasedApps: MikkeOwnerMenuItem[] = [
  { title: "MarketNote", href: "/marketnote", icon: CalendarDays, tone: "orange" },
  { title: "Story", href: "/story", icon: BookOpenText, tone: "blue" },
  { title: "Community", href: "/community", icon: Users, tone: "yellow" }
];
