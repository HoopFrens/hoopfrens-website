export type AdminAuthorizationUser = { uid: string } | null;
export type AdminUserDocument = { exists: boolean; role?: unknown };

export type AdminAuthorizationResult =
  | { allowed: true; reason: "admin" }
  | { allowed: false; reason: "unauthenticated" | "missing-user" | "missing-role" | "not-admin" | "lookup-failed" };

export const adminAuthorizationService = {
  async authorize(
    user: AdminAuthorizationUser,
    loadUserDocument: (uid: string) => Promise<AdminUserDocument>,
  ): Promise<AdminAuthorizationResult> {
    if (!user) return { allowed: false, reason: "unauthenticated" };

    try {
      const userDocument = await loadUserDocument(user.uid);
      if (!userDocument.exists) return { allowed: false, reason: "missing-user" };
      if (typeof userDocument.role !== "string") return { allowed: false, reason: "missing-role" };
      if (userDocument.role !== "admin") return { allowed: false, reason: "not-admin" };
      return { allowed: true, reason: "admin" };
    } catch {
      return { allowed: false, reason: "lookup-failed" };
    }
  },
};
