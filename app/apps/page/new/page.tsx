import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { PageNewSiteForm } from "@/components/page/PageNewSiteForm";

export default function PageNewPage() {
  return (
    <AuthGate>
      <MikkeAppShell
        appName="Page"
        title="新しいPage"
        subtitle="団体・ブランド・事業のサイト下書きを作ります。"
        currentApp={{ label: "Page", href: "/apps/page" }}
      >
        <PageNewSiteForm />
      </MikkeAppShell>
    </AuthGate>
  );
}
