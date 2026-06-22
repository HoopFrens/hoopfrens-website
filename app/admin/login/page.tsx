import { AdminLogin } from "@/components/admin/AdminLogin";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login",
  description: "Sign in to the Hoop Frens admin dashboard.",
};

export default function AdminLoginPage() {
  return <AdminLogin />;
}
