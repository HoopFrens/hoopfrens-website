import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create | Hoop Frens Headquarters",
  description: "Protected Founder-Simple creation workflows.",
};

export default function CreatePage() {
  return <ExecutiveWorkspaceShell activeSpaceId="create" />;
}
