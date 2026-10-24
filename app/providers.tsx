"use client";

import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { WorkspaceProvider } from "@/lib/workspace/store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
