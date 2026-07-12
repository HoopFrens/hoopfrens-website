import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strategy Room",
  description: "Internal Hoop Frens strategy workspace shell.",
};

export default function StrategyRoomPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="strategy-room" />;
}
