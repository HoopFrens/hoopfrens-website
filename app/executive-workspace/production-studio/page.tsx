import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Production Studio",
  description: "Internal Hoop Frens production workspace shell.",
};

export default function ProductionStudioPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="production-studio" />;
}
