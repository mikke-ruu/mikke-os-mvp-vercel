import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { LibraryScreen } from "@/components/library/LibraryScreen";

export default function LibraryAppPage() {
  return (
    <Suspense fallback={null}>
      <AuthGate>
        <LibraryScreen />
      </AuthGate>
    </Suspense>
  );
}
