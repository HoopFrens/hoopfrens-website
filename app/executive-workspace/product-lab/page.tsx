import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Lab",
  description: "Internal Hoop Frens product workspace shell.",
};

export default function ProductLabPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="product-lab" />;
}
