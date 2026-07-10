import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description: "Internal Hoop Frens project workspace.",
};

export default function ProjectsPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="projects" />;
}
