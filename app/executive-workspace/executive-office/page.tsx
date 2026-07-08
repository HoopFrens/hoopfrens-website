import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Executive Office",
  description: "Internal Hoop Frens Executive Workspace shell.",
};

export default function ExecutiveOfficePage() {
  return <ExecutiveWorkspaceShell activeSpaceId="executive-office" />;
}
