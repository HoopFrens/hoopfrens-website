import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intelligence Center",
  description: "Internal Hoop Frens intelligence workspace shell.",
};

export default function IntelligenceCenterPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="intelligence-center" />;
}
