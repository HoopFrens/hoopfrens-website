import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  description: "Secure Hoop Frens content management dashboard.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
