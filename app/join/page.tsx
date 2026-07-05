import { NewsletterSignup } from "@/components/NewsletterSignup";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Community",
  description: "Join the Hoop Frens community for stories, live-game alerts, recruiting guidance, and coverage across every college basketball pathway.",
};

export default function JoinPage() {
  return (
    <div className="pt-20">
      <NewsletterSignup />
    </div>
  );
}
