import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today | Hoop Frens Headquarters",
  description: "Protected Hoop Frens Founder brief and next actions.",
};

export default function TodayPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="executive-office" />;
}
