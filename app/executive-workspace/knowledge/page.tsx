import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowledge Center",
  description: "Protected Hoop Frens Knowledge Graph workspace.",
};

export default function KnowledgeCenterPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="knowledge-center" />;
}
