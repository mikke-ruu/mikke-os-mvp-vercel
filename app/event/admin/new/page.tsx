"use client";

import { AuthGate } from "@/components/AuthGate";
import { EventForm } from "@/components/event/EventForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";

export default function EventAdminNewPage() {
  return (
    <AuthGate>
      <MikkeAppShell appName="Event" title="イベントを作成" currentApp={{ label: "Event", href: "/apps/event" }} footerLabel="Event by mikke">
        <EventForm />
      </MikkeAppShell>
    </AuthGate>
  );
}
