import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Make a post",
  description: "Create and review an Instagram carousel with a caption.",
};

export default function IntelligenceCenterPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="intelligence-center" />;
}
