import { ExecutiveWorkspaceShell } from "@/components/executive/ExecutiveWorkspaceShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review & Approve | Hoop Frens Headquarters",
  description: "Protected Founder content review and approval queue.",
};

export default function ReviewPage() {
  return <ExecutiveWorkspaceShell activeSpaceId="review-approve" />;
}
