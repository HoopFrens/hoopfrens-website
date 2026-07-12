import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Library",
  description: "Internal Hoop Frens library workspace shell.",
};

export default function LibraryPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="library" />;
}
