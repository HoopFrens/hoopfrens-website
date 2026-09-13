import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Make a post | Hoop Frens",
  description: "Create and review a Hoop Frens Instagram carousel.",
};

export default function TodayPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="intelligence-center" />;
}
