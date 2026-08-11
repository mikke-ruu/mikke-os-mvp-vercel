import { HqShell } from "@/components/hq/HqShell";

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return <HqShell>{children}</HqShell>;
}
